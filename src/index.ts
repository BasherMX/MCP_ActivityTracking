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

const AGENT_INSTRUCTIONS = `INSTRUCCIONES OPERATIVAS PARA ASISTENTES DE IA — Activity Tracking MCP (DCMTIC)

Seguridad: toda operación de escritura (create/update/delete/advance/log/attach) tiene dryRun=true por defecto. Ejecuta primero en dry-run, valida el resultado, y solo entonces repite con dryRun:false.

1) IDENTIDAD DEL USUARIO ACTIVO ("yo", "mi persona"):
   Cuando el usuario se refiera a sí mismo ("crea una actividad para mí", "mis actividades", "mis horas"), interpreta "yo" como el usuario autenticado dinámicamente en la sesión actual. No recurras a valores fijos arbitrarios.

2) REDACCIÓN Y TÍTULOS DE ACTIVIDADES:
   - No antepongas artificialmente verbos redundantes como "Desarrollar" si el usuario ya proporcionó una descripción estructurada del objetivo.
   - NUNCA trunques títulos con puntos suspensivos ("..."). Los títulos deben ser completos, concisos y profesionales.

3) AVANCE DE ETAPAS Y REGISTRO DE TRABAJO (REGLA ESTRICTA):
   - Al invocar track_advance_process_stage, el usuario debe describir qué hizo específicamente en esa etapa. Si no lo hace, SOLICÍTASELO explícitamente antes de ejecutar la acción.
   - Mejora la redacción del usuario dándole un tono técnico formal, claro y profesional antes de guardarlo en las notas de avance.
   - DISTRIBUCIÓN PONDERADA DEL TIEMPO: El tiempo no se asigna plano. En actividades con flujo por etapas:
     a) Etapas pasivas/recepción: 0.0 horas.
     b) Etapas de ejecución/desarrollo: 80% a 90% del tiempo total.
     c) Etapas de cierre/evidencia/notificación: 10% a 20% restante.

4) COLABORADORES EN ETAPAS (APOYO TOTAL VS PARCIAL):
   - Apoyo total en una etapa: usa track_add_stage_collaborator({ progressId, responsibleId }) para registrar formalmente al colaborador en la etapa.
   - Apoyo parcial en una etapa (ej. 15 minutos): registra las horas con track_log_work_hours indicando el stageProgressId y la bandera isSupport: true.

5) CIERRE DE ACTIVIDADES CON PRODUCTO (productApplicable:true):
   track_close_activity SOLO marca status=Completed. Si la actividad tiene producto con etapas, NUNCA la cierres sin antes asegurar que se avanzaron todas las etapas y se registraron las horas por etapa.

6) REPORTES Y CAPACIDAD:
   - Para consultar el resumen diario real consolidado usa track_get_daily_report.
   - Para evaluar el balance de trabajo semanal/mensual usa track_get_capacity_workload (el porcentaje de captura debe mantenerse por encima del 60% de la capacidad esperada).

7) REPORTE DE FALLAS TÉCNICAS:
   - Para reportar bugs o errores del sistema usa track_report_app_issue con title, description y severity.

8) Catálogo de tipos: el valor correcto para "Diseño" es el literal "Desing" (typo oficial del backend).

Ver docs/AI_AGENT_NOTES.md para el detalle completo y ejemplos.`;

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
      instructions: AGENT_INSTRUCTIONS,
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
