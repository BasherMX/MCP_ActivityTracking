import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.resolve(__dirname, '../dist/index.js');

console.log('=== Iniciando Prueba de Integración MCP Stdio ===');
console.log(`Ejecutable del servidor: ${serverPath}`);

const child = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'], // stderr va a la consola, stdin/stdout son pipes
});

let buffer = '';
let messageId = 1;

function sendRpc(method: string, params: any = {}) {
  const msg = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params,
  };
  const str = JSON.stringify(msg);
  // Según la especificación MCP Stdio, los mensajes se envían delimitados por salto de línea (\n)
  child.stdin.write(str + '\n');
}

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      console.log(`[STDIO RESPUESTA RPC] ID: ${response.id}`);

      if (response.id === 1) {
        console.log('✅ Handshake Initialize exitoso:', response.result?.serverInfo);
        // Paso 2: Listar herramientas
        sendRpc('tools/list');
      } else if (response.id === 2) {
        const tools = response.result?.tools || [];
        console.log(`✅ tools/list exitoso. Herramientas disponibles (${tools.length}):`);
        tools.forEach((t: any) => console.log(`   - ${t.name}`));

        // Paso 3: Probar invocación de herramienta
        console.log('\nEjecutando tools/call track_create_activity (Dry-Run)...');
        sendRpc('tools/call', {
          name: 'track_create_activity',
          arguments: {
            description: 'Prueba de integración MCP Stdio sobre Comunidad Informática',
            dryRun: true,
          },
        });
      } else if (response.id === 3) {
        console.log('✅ tools/call exitoso. Contenido devuelto:');
        console.log(response.result?.content?.[0]?.text);
        console.log('\n>>> PRUEBA STDIO COMPLETADA EXITOSAMENTE. CERRANDO SERVIDOR... <<<');
        child.kill();
        process.exit(0);
      }
    } catch (e: any) {
      console.error('Error parseando JSON-RPC desde stdout:', line);
    }
  }
});

child.on('error', (err) => {
  console.error('Error en proceso hijo:', err);
  process.exit(1);
});

// Paso 1: Enviar initialize
sendRpc('initialize', {
  protocolVersion: '2024-11-05',
  clientInfo: { name: 'TestClient', version: '1.0.0' },
  capabilities: {},
});
