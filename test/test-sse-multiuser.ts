import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.resolve(__dirname, '../dist/index.js');
const TEST_PORT = 3335;

console.log('====================================================');
console.log('=== TEST INTEGRACIÓN: SSE Multi-Usuario y Sesiones ===');
console.log('====================================================');

// Iniciar servidor MCP en modo SSE en puerto aislado 3335
const serverProcess = spawn('node', [serverPath, '--sse'], {
  env: {
    ...process.env,
    PORT: String(TEST_PORT),
    HOST: '127.0.0.1',
    MCP_TRANSPORT: 'sse',
    DRY_RUN_MODE: 'true',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SseClient {
  username: string;
  sessionId: string;
  endpoint: string;
  messages: any[];
  req: http.ClientRequest;
}

function connectSse(username: string): Promise<SseClient> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    let sessionId = '';
    let endpoint = '';
    let buffer = '';

    const req = http.request(
      `http://127.0.0.1:${TEST_PORT}/sse`,
      {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'X-Auth-Username': username,
          'X-Auth-Password': 'mockPassword123',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Respuesta SSE fallida con status ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const ev of events) {
            if (!ev.trim()) continue;
            const lines = ev.split('\n');
            let eventType = 'message';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.replace('event:', '').trim();
              } else if (line.startsWith('data:')) {
                dataStr = line.replace('data:', '').trim();
              }
            }

            if (eventType === 'endpoint') {
              endpoint = dataStr;
              const url = new URL(endpoint, `http://127.0.0.1:${TEST_PORT}`);
              sessionId = url.searchParams.get('sessionId') || '';
              console.log(`[SSE ${username}] Handshake recibido. Endpoint: ${endpoint} | SessionId: ${sessionId}`);
              resolve({
                username,
                sessionId,
                endpoint,
                messages,
                req,
              });
            } else if (eventType === 'message' && dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                console.log(`[SSE ${username}] Mensaje JSON-RPC recibido:`, parsed.id || parsed.method);
                messages.push(parsed);
              } catch {
                console.log(`[SSE ${username}] Mensaje crudo recibido:`, dataStr);
              }
            }
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

function postRpc(client: SseClient, msg: any): Promise<number> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(msg);
    const postUrl = `http://127.0.0.1:${TEST_PORT}/messages?sessionId=${client.sessionId}`;

    const req = http.request(
      postUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Auth-Username': client.username,
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode || 0));
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function fetchHealth(): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/health`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c.toString()));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function runTest() {
  try {
    // 1. Esperar arranque del servidor
    console.log('Esperando que el servidor inicie en puerto 3335...');
    await sleep(1500);

    // 2. Verificar Health Check
    const health1 = await fetchHealth();
    console.log('✅ Health check inicial exitoso:', health1);

    // 3. Conectar Usuario 1 (Adrian)
    console.log('\n--- Conectando Usuario 1 (adrian.garcia) vía SSE ---');
    const user1 = await connectSse('adrian.garcia');

    // 4. Conectar Usuario 2 (Brayan)
    console.log('\n--- Conectando Usuario 2 (brayan.vazquez) vía SSE ---');
    const user2 = await connectSse('brayan.vazquez');

    // 5. Verificar que el servidor tiene 2 sesiones activas concurrentes
    const health2 = await fetchHealth();
    console.log(`\n✅ Sesiones activas reportadas en /health: ${health2.activeSessions}`);
    if (health2.activeSessions !== 2) {
      throw new Error(`Se esperaban 2 sesiones activas pero se encontraron ${health2.activeSessions}`);
    }

    // 6. Enviar Initialize a ambos usuarios concurrentemente
    console.log('\n--- Enviando JSON-RPC initialize para ambos usuarios ---');
    await Promise.all([
      postRpc(user1, {
        jsonrpc: '2.0',
        id: 101,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'AdrianClient', version: '1.0' },
          capabilities: {},
        },
      }),
      postRpc(user2, {
        jsonrpc: '2.0',
        id: 201,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'BrayanClient', version: '1.0' },
          capabilities: {},
        },
      }),
    ]);

    await sleep(1000);

    // 7. Enviar CallTool concurrentemente para ambos usuarios
    console.log('\n--- Invocando track_create_activity concurrentemente para User1 y User2 ---');
    await Promise.all([
      postRpc(user1, {
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'track_create_activity',
          arguments: {
            description: 'Actividad de Adrián García en Comunidad Informática',
            dryRun: true,
          },
        },
      }),
      postRpc(user2, {
        jsonrpc: '2.0',
        id: 202,
        method: 'tools/call',
        params: {
          name: 'track_create_activity',
          arguments: {
            description: 'Actividad de Brayan Vázquez en Soporte Redes',
            dryRun: true,
          },
        },
      }),
    ]);

    await sleep(1500);

    // 8. Verificar que cada usuario recibió sus respuestas en su canal SSE
    const u1Response = user1.messages.find((m) => m.id === 102);
    const u2Response = user2.messages.find((m) => m.id === 202);

    if (!u1Response) throw new Error('Usuario 1 no recibió respuesta para su RPC id 102');
    if (!u2Response) throw new Error('Usuario 2 no recibió respuesta para su RPC id 202');

    console.log('\n✅ Respuesta recibida por Usuario 1 (Adrián):');
    console.log(u1Response.result?.content?.[0]?.text?.substring(0, 180) + '...');

    console.log('\n✅ Respuesta recibida por Usuario 2 (Brayan):');
    console.log(u2Response.result?.content?.[0]?.text?.substring(0, 180) + '...');

    console.log('\n====================================================');
    console.log('>>> ¡TEST SSE MULTI-USUARIO COMPLETADO CON ÉXITO! <<<');
    console.log('====================================================');

    user1.req.destroy();
    user2.req.destroy();
    serverProcess.kill();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en test multi-usuario:', err);
    serverProcess.kill();
    process.exit(1);
  }
}

runTest();
