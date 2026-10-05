import axios, { AxiosInstance } from 'axios';
import http from 'node:http';
import https from 'node:https';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

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

// Interceptor para depuración en stderr (nunca en stdout)
apiClient.interceptors.request.use(
  (config) => {
    logger.debug(`[HTTP REQ] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
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
    } else if (error.request) {
      logger.error(`[HTTP NET ERROR] No hubo respuesta del servidor ${env.API_BASE_URL}:`, error.message);
    } else {
      logger.error('[HTTP ERROR]', error.message);
    }
    return Promise.reject(error);
  }
);
