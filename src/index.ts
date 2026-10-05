#!/usr/bin/env node

import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getToolDefinitions, handleToolCall } from './tools/index.js';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';
import {
  UserSession,
  sessionManager,
  runInSession,
  getCurrentSession,
} from './services/session-context.js';
import { authManager } from './services/auth-manager.js';

/**
 * Fábrica de instancias de MCP Server.
 * En el SDK MCP oficial, cada transporte conectado requiere su propia instancia de Protocol/Server.
 */
export function createMcpServer(session?: UserSession): Server {
  const server = new Server(
    {
      name: 'activity-tracking-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. Registro del listado de herramientas
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Solicitud ListToolsRequest recibida.');
    return {
      tools: getToolDefinitions(),
    };
  });

  // 2. Manejador de invocación de herramientas con aislamiento por sesión
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    logger.info(`Invocando herramienta MCP: '${name}'`);
    logger.debug(`Argumentos:`, JSON.stringify(args));

    // Determinar la sesión de usuario activa
    const activeSession =
      session ||
      (extra?.sessionId ? sessionManager.getSession(extra.sessionId) : undefined) ||
      getCurrentSession();

    const executeCall = async () => {
      try {
        const result = await handleToolCall(name, args);
        logger.info(`Herramienta '${name}' ejecutada con éxito.`);

        return {
          content: [
            {
              type: 'text' as const,
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        logger.error(`Error ejecutando herramienta '${name}':`, error?.message || error);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: true,
                  tool: name,
                  message: error?.message || 'Error desconocido al ejecutar la herramienta',
                  details: error?.response?.data || undefined,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    };

    if (activeSession) {
      return await runInSession(activeSession, executeCall);
    } else {
      return await executeCall();
    }
  });

  return server;
}

// Mapa en memoria de transportes SSE y sus servidores asociados por sessionId
const transports = new Map<string, { transport: SSEServerTransport; server: Server }>();

/**
 * Extrae credenciales de usuario de las cabeceras HTTP o query params.
 */
function extractCredentials(req: Request): { username: string; password?: string } {
  let username = (req.headers['x-auth-username'] as string) || (req.query.username as string) || '';
  let password = (req.headers['x-auth-password'] as string) || (req.query.password as string) || '';

  // Soporte adicional: Basic Auth en Authorization header
  if (!username && req.headers.authorization?.startsWith('Basic ')) {
    try {
      const b64 = req.headers.authorization.slice(6).trim();
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        username = decoded.substring(0, colonIdx);
        password = decoded.substring(colonIdx + 1);
      }
    } catch {
      // Ignorar fallo de decodificación
    }
  }

  return { username: username.trim(), password: password || undefined };
}

async function main() {
  // Determinar transporte según argumentos de línea de comandos o variable de entorno
  let transportMode = env.MCP_TRANSPORT;
  if (process.argv.includes('--stdio')) transportMode = 'stdio';
  if (process.argv.includes('--sse')) transportMode = 'sse';
  if (process.argv.includes('--both')) transportMode = 'both';

  logger.info('====================================================');
  logger.info('Iniciando Servidor MCP Activity Tracking Centralizado...');
  logger.info(`Modo de Transporte: ${transportMode.toUpperCase()}`);
  logger.info(`Endpoint API: ${env.API_BASE_URL}`);
  logger.info(`Modo Dry-Run: ${env.DRY_RUN_MODE ? 'ACTIVO (Seguro para Producción)' : 'INACTIVO'}`);
  logger.info(`Usuario institucional por defecto: ${env.AUTH_USERNAME}`);
  logger.info('====================================================');

  // Iniciar servidor HTTP/SSE si aplica
  if (transportMode === 'sse' || transportMode === 'both') {
    const app = express();
    app.use(express.json());

    // 1. Endpoint de verificación de estado
    app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        server: 'activity-tracking-mcp-server',
        transport: transportMode,
        activeSessions: transports.size,
        uptimeSeconds: Math.floor(process.uptime()),
        dryRunMode: env.DRY_RUN_MODE,
        apiBaseUrl: env.API_BASE_URL,
      });
    });

    // 2. Endpoint SSE para suscripción y establecimiento de canal
    const handleSseConnection = async (req: Request, res: Response) => {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const { username, password } = extractCredentials(req);
      logger.info(`Nueva conexión SSE desde ${clientIp} [Usuario solicitado: '${username || 'anónimo'}']`);

      try {
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;

        const session = sessionManager.getOrCreateSession(sessionId, username, password);
        const server = createMcpServer(session);

        transports.set(sessionId, { transport, server });

        // Si se enviaron credenciales en el handshake, autenticar en segundo plano para precargar JWT
        if (username && password) {
          runInSession(session, async () => {
            try {
              await authManager.getValidToken();
              logger.info(`Sesión SSE ${sessionId} pre-autenticada con éxito para '${username}'.`);
            } catch (authErr: any) {
              logger.warn(`No se pudo pre-autenticar '${username}':`, authErr?.message);
            }
          });
        }

        transport.onclose = () => {
          logger.info(`Conexión SSE cerrada para sesión: ${sessionId}`);
          transports.delete(sessionId);
          sessionManager.deleteSession(sessionId);
        };

        await server.connect(transport);
        logger.info(`Canal SSE activo y registrado [sessionId: ${sessionId}]`);
      } catch (error: any) {
        logger.error('Error al establecer conexión SSE:', error);
        if (!res.headersSent) {
          res.status(500).send('Error establishing SSE stream');
        }
      }
    };

    app.get('/sse', handleSseConnection);
    app.get('/mcp', handleSseConnection);

    // 3. Endpoint POST para recepción de mensajes JSON-RPC
    app.post('/messages', async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        logger.warn('POST /messages recibido sin parámetro sessionId');
        res.status(400).send('Missing sessionId parameter');
        return;
      }

      const sessionEntry = transports.get(sessionId);
      if (!sessionEntry) {
        logger.warn(`POST /messages recibido para sesión inexistente o expirada: ${sessionId}`);
        res.status(404).send('Session not found or expired');
        return;
      }

      const { transport } = sessionEntry;
      const session = sessionManager.getSession(sessionId);

      // Actualizar credenciales si vienen provistas en este request POST específico
      const { username: postUser, password: postPass } = extractCredentials(req);
      if (session) {
        if (postUser) session.username = postUser;
        if (postPass) session.password = postPass;
        session.lastActiveAt = Date.now();
      }

      try {
        if (session) {
          await runInSession(session, async () => {
            await transport.handlePostMessage(req, res, req.body);
          });
        } else {
          await transport.handlePostMessage(req, res, req.body);
        }
      } catch (error: any) {
        logger.error(`Error procesando mensaje POST en sesión ${sessionId}:`, error);
        if (!res.headersSent) {
          res.status(500).send('Error handling request');
        }
      }
    });

    const httpServer = app.listen(env.PORT, env.HOST, () => {
      logger.info(`Servidor HTTP/SSE escuchando en http://${env.HOST}:${env.PORT}`);
      logger.info(`   -> Endpoint SSE: http://${env.HOST}:${env.PORT}/sse`);
      logger.info(`   -> Endpoint Health: http://${env.HOST}:${env.PORT}/health`);
    });

    httpServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && transportMode === 'both') {
        logger.warn(`Puerto ${env.PORT} ocupado. Continuando en modo Stdio.`);
      } else {
        logger.error(`Error en servidor HTTP en puerto ${env.PORT}:`, err);
        if (transportMode === 'sse') {
          process.exit(1);
        }
      }
    });
  }

  // Iniciar servidor Stdio si aplica
  if (transportMode === 'stdio' || transportMode === 'both') {
    const stdioServer = createMcpServer();
    const stdioTransport = new StdioServerTransport();
    await stdioServer.connect(stdioTransport);
    logger.info('Servidor MCP conectado y escuchando vía Stdio JSON-RPC 2.0.');
  }

  // Manejo de señales de terminación
  const shutdown = async () => {
    logger.info('Cerrando servidor MCP...');
    for (const [sessionId, entry] of transports.entries()) {
      try {
        await entry.transport.close();
        await entry.server.close();
      } catch {
        // Ignorar errores al cerrar transporte
      }
    }
    transports.clear();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error('Error fatal al iniciar servidor MCP:', error);
  process.exit(1);
});
