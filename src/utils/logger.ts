/**
 * Utilidad de Logging para el servidor MCP.
 * REGLA CRÍTICA MCP: Jamás escribir logs a stdout (console.log), ya que corrompe
 * el protocolo JSON-RPC 2.0 que viaja sobre stdio. Todos los logs van a stderr.
 */

export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[INFO  ${timestamp}] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[WARN  ${timestamp}] ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR ${timestamp}] ${msg}`, ...args);
  },
  debug: (msg: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[DEBUG ${timestamp}] ${msg}`, ...args);
  },
};
