import { apiClient } from './api-client.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ResponsibleDto, AuthenticateDto } from '../types/openapi.js';

class AuthManager {
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;
  private responsibleInfo: ResponsibleDto | null = null;
  private isAuthenticating: Promise<string | null> | null = null;

  /**
   * Obtiene un token JWT válido. Si no existe o está próximo a expirar, ejecuta login.
   */
  public async getValidToken(): Promise<string | null> {
    const now = Date.now();
    // Si tenemos token y aún le quedan al menos 3 minutos de vida
    if (this.token && this.tokenExpiresAt && this.tokenExpiresAt - now > 3 * 60 * 1000) {
      return this.token;
    }

    if (this.isAuthenticating) {
      return this.isAuthenticating;
    }

    this.isAuthenticating = this.authenticate();
    try {
      return await this.isAuthenticating;
    } finally {
      this.isAuthenticating = null;
    }
  }

  /**
   * Ejecuta la autenticación contra /api/v1/Responsibles/authenticate
   */
  public async authenticate(): Promise<string | null> {
    try {
      logger.info(`Autenticando usuario '${env.AUTH_USERNAME}' en ${env.API_BASE_URL}...`);
      const body: AuthenticateDto = {
        username: env.AUTH_USERNAME,
        password: env.AUTH_PASSWORD,
      };

      const response = await apiClient.post<ResponsibleDto>('/api/v1/Responsibles/authenticate', body);

      if (response.data && response.data.token) {
        this.token = response.data.token;
        this.responsibleInfo = response.data;
        // Asignamos validez por defecto de 8 horas si no decodificamos el JWT
        this.tokenExpiresAt = Date.now() + 8 * 60 * 60 * 1000;

        // Intentar leer expiración del JWT (exp claim)
        try {
          const parts = this.token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.exp) {
              this.tokenExpiresAt = payload.exp * 1000;
            }
          }
        } catch {
          // Ignorar fallo de decodificación y usar expiración estimada
        }

        // Configurar el header global de autenticación por defecto
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        logger.info(`Autenticación exitosa para '${response.data.fullName || env.AUTH_USERNAME}'. Token almacenado en memoria.`);
        return this.token;
      }

      logger.warn('La respuesta de autenticación no incluyó token JWT.');
      return null;
    } catch (error: any) {
      logger.error('Error al autenticar contra la API:', error?.response?.data || error?.message || error);
      return null;
    }
  }

  /**
   * Invalida el token en memoria (usado cuando la API devuelve 401)
   */
  public invalidateToken(): void {
    logger.warn('Invalidando token en memoria tras error 401.');
    this.token = null;
    this.tokenExpiresAt = null;
    this.responsibleInfo = null;
    delete apiClient.defaults.headers.common['Authorization'];
  }

  public getCachedResponsible(): ResponsibleDto | null {
    return this.responsibleInfo;
  }

  /**
   * Obtiene dinámicamente el ID del responsable autenticado (o fallback configurado).
   */
  public getResponsibleId(): number {
    if (this.responsibleInfo && typeof this.responsibleInfo.id === 'number' && this.responsibleInfo.id > 0) {
      return this.responsibleInfo.id;
    }
    return env.DEFAULT_RESPONSIBLE_ID || 6;
  }

  /**
   * Obtiene dinámicamente el nombre completo del responsable autenticado.
   */
  public getResponsibleName(): string {
    if (this.responsibleInfo && this.responsibleInfo.fullName) {
      return this.responsibleInfo.fullName;
    }
    return env.DEFAULT_RESPONSIBLE_NAME || env.AUTH_USERNAME;
  }

  /**
   * Obtiene dinámicamente el ID del servicio asignado al responsable (o fallback configurado).
   */
  public getDefaultServiceId(): number {
    if (this.responsibleInfo && this.responsibleInfo.services && this.responsibleInfo.services.length > 0) {
      const primaryService = this.responsibleInfo.services[0];
      const sId = (primaryService as any)?.id || primaryService?.serviceId;
      if (typeof sId === 'number' && sId > 0) {
        return sId;
      }
    }
    return env.DEFAULT_SERVICE_ID || 4;
  }
}

export const authManager = new AuthManager();

