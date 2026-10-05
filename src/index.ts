#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getToolDefinitions, handleToolCall } from './tools/index.js';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';

async function main() {
  logger.info('====================================================');
  logger.info('Iniciando Servidor MCP Activity Tracking...');
  logger.info(`Endpoint API: ${env.API_BASE_URL}`);
  logger.info(`Modo Dry-Run: ${env.DRY_RUN_MODE ? 'ACTIVO (Seguro para Producción)' : 'INACTIVO'}`);
  logger.info(`Usuario por defecto: ${env.AUTH_USERNAME} (responsibleId: ${env.DEFAULT_RESPONSIBLE_ID})`);
  logger.info('====================================================');

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

  // 2. Manejador de invocación de herramientas
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Invocando herramienta MCP: '${name}'`);
    logger.debug(`Argumentos:`, JSON.stringify(args));

    try {
      const result = await handleToolCall(name, args);
      logger.info(`Herramienta '${name}' ejecutada con éxito.`);

      return {
        content: [
          {
            type: 'text',
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
            type: 'text',
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
  });

  // 3. Conexión del transporte Stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Servidor MCP conectado y escuchando vía Stdio JSON-RPC 2.0.');

  // Manejo de señales de terminación
  const shutdown = async () => {
    logger.info('Cerrando servidor MCP...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error('Error fatal al iniciar servidor MCP:', error);
  process.exit(1);
});
