import axios, { AxiosInstance } from 'axios';
import http from 'node:http';
import https from 'node:https';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getCurrentSession } from './session-context.js';
import { authManager } from './auth-manager.js';

const isHttps = env.API_BASE_URL.startsWith('https');

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: env.API_TIMEOUT_MS,
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
  },
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: isHttps
    ? new https.Agent({
        rejectUnauthorized: env.API_REJECT_UNAUTHORIZED,
        keepAlive: true,
      })
    : undefined,
});

// Interceptor para inyección dinámica y aislada de Bearer token por sesión
apiClient.interceptors.request.use(
  (config) => {
    // Si la llamada no define explícitamente Authorization (ej: login lo pasa vacío)
    if (config.headers && config.headers['Authorization'] === undefined) {
      const token = authManager.getCurrentToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const session = getCurrentSession();
    const userLabel = session?.username || env.AUTH_USERNAME;
    logger.debug(`[HTTP REQ] ${config.method?.toUpperCase()} ${config.baseURL}${config.url} [User: ${userLabel}]`);
    return config;
  },
  (error) => {
    logger.error('[HTTP REQ ERROR]', error?.message || error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    logger.debug(`[HTTP RES] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      logger.error(`[HTTP RES ERROR] ${error.response.status} ${error.config?.url}:`, JSON.stringify(error.response.data));
      // Si la API rechaza el token (401), invalidar en memoria para forzar re-login en la siguiente petición
      if (error.response.status === 401) {
        authManager.invalidateToken();
      }
    } else if (error.request) {
      logger.error(`[HTTP NET ERROR] No hubo respuesta del servidor ${env.API_BASE_URL}:`, error.message);
    } else {
      logger.error('[HTTP ERROR]', error.message);
    }
    return Promise.reject(error);
  }
);
