import { apiClient } from './api-client.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ResponsibleDto, AuthenticateDto } from '../types/openapi.js';
import { getCurrentSession } from './session-context.js';

interface CachedAuth {
  token: string;
  tokenExpiresAt: number;
  responsibleInfo: ResponsibleDto;
}

class AuthManager {
  // Caché global en memoria de tokens válidos indexados por username (minúsculas)
  private userAuthCache = new Map<string, CachedAuth>();

  // Promesas de autenticación activas para evitar peticiones duplicadas simultáneas por usuario
  private pendingAuth = new Map<string, Promise<string | null>>();

  // Fallback para ejecución standalone (Stdio / scripts)
  private defaultToken: string | null = null;
  private defaultTokenExpiresAt: number | null = null;
  private defaultResponsibleInfo: ResponsibleDto | null = null;

  /**
   * Obtiene un token JWT válido para el contexto de usuario actual.
   * Si no existe o está por expirar, ejecuta login automático.
   */
  public async getValidToken(): Promise<string | null> {
    const session = getCurrentSession();
    const now = Date.now();
    const minLifeMs = 3 * 60 * 1000; // Al menos 3 minutos de vigencia

    // 1. Contexto de sesión multi-usuario activo
    if (session && (session.username || session.token)) {
      if (session.token && session.tokenExpiresAt && session.tokenExpiresAt - now > minLifeMs) {
        return session.token;
      }

      const targetUsername = session.username || env.AUTH_USERNAME;
      const targetKey = targetUsername.toLowerCase();

      // Verificar si tenemos un token en caché para este usuario
      const cached = this.userAuthCache.get(targetKey);
      if (cached && cached.tokenExpiresAt - now > minLifeMs) {
        session.token = cached.token;
        session.tokenExpiresAt = cached.tokenExpiresAt;
        session.responsibleInfo = cached.responsibleInfo;
        return session.token;
      }

      // Si no hay token en caché, autenticar con las credenciales de la sesión
      const password = session.password || (targetUsername === env.AUTH_USERNAME ? env.AUTH_PASSWORD : '');
      const token = await this.authenticate(targetUsername, password);
      if (token) {
        session.token = token;
        const fresh = this.userAuthCache.get(targetKey);
        if (fresh) {
          session.responsibleInfo = fresh.responsibleInfo;
          session.tokenExpiresAt = fresh.tokenExpiresAt;
        }
      }
      return token;
    }

    // 2. Modo fallback (Stdio / Scripts directos usando .env)
    if (this.defaultToken && this.defaultTokenExpiresAt && this.defaultTokenExpiresAt - now > minLifeMs) {
      return this.defaultToken;
    }

    const defaultKey = env.AUTH_USERNAME.toLowerCase();
    const cachedDefault = this.userAuthCache.get(defaultKey);
    if (cachedDefault && cachedDefault.tokenExpiresAt - now > minLifeMs) {
      this.defaultToken = cachedDefault.token;
      this.defaultTokenExpiresAt = cachedDefault.tokenExpiresAt;
      this.defaultResponsibleInfo = cachedDefault.responsibleInfo;
      return this.defaultToken;
    }

    return await this.authenticate(env.AUTH_USERNAME, env.AUTH_PASSWORD);
  }

  /**
   * Ejecuta autenticación contra /api/v1/Responsibles/authenticate
   */
  public async authenticate(customUsername?: string, customPassword?: string): Promise<string | null> {
    const session = getCurrentSession();
    const username = (customUsername || session?.username || env.AUTH_USERNAME).trim();
    const password = customPassword !== undefined ? customPassword : (session?.password || env.AUTH_PASSWORD);

    if (!username) {
      logger.error('No se ha proporcionado nombre de usuario para autenticación.');
      return null;
    }

    const authKey = username.toLowerCase();

    // Evitar peticiones concurrentes duplicadas para el mismo usuario
    const pending = this.pendingAuth.get(authKey);
    if (pending) {
      return pending;
    }

    const authPromise = (async () => {
      try {
        logger.info(`Autenticando usuario '${username}' en ${env.API_BASE_URL}...`);
        const body: AuthenticateDto = {
          username,
          password,
        };

        const response = await apiClient.post<ResponsibleDto>('/api/v1/Responsibles/authenticate', body, {
          // La petición de login nunca debe llevar header de autorización previo
          headers: {
            Authorization: '',
          },
        });

        if (response.data && response.data.token) {
          const token = response.data.token;
          let expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 horas por defecto

          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              if (payload.exp) {
                expiresAt = payload.exp * 1000;
              }
            }
          } catch {
            // Ignorar fallo de decodificación y usar expiración estimada
          }

          const authData: CachedAuth = {
            token,
            tokenExpiresAt: expiresAt,
            responsibleInfo: response.data,
          };

          this.userAuthCache.set(authKey, authData);

          // Si estamos en una sesión activa, asignarle sus datos
          if (session && session.username.toLowerCase() === authKey) {
            session.token = token;
            session.tokenExpiresAt = expiresAt;
            session.responsibleInfo = response.data;
          }

          // Si es el usuario por defecto o stdio
          if (username.toLowerCase() === env.AUTH_USERNAME.toLowerCase()) {
            this.defaultToken = token;
            this.defaultTokenExpiresAt = expiresAt;
            this.defaultResponsibleInfo = response.data;
          }

          logger.info(`Autenticación exitosa para '${response.data.fullName || username}'. Token JWT aislado en memoria.`);
          return token;
        }

        logger.warn(`La respuesta de autenticación para '${username}' no incluyó token JWT.`);
        return null;
      } catch (error: any) {
        logger.error(`Error al autenticar usuario '${username}' contra la API:`, error?.response?.data || error?.message || error);
        return null;
      } finally {
        this.pendingAuth.delete(authKey);
      }
    })();

    this.pendingAuth.set(authKey, authPromise);
    return authPromise;
  }

  /**
   * Invalida el token en memoria tras error 401
   */
  public invalidateToken(): void {
    const session = getCurrentSession();
    if (session) {
      logger.warn(`Invalidando token en memoria para sesión ${session.sessionId} (usuario '${session.username}') tras error 401.`);
      if (session.username) {
        this.userAuthCache.delete(session.username.toLowerCase());
      }
      session.token = undefined;
      session.tokenExpiresAt = undefined;
      session.responsibleInfo = undefined;
    } else {
      logger.warn('Invalidando token por defecto en memoria tras error 401.');
      this.userAuthCache.delete(env.AUTH_USERNAME.toLowerCase());
      this.defaultToken = null;
      this.defaultTokenExpiresAt = null;
      this.defaultResponsibleInfo = null;
    }
  }

  /**
   * Retorna el token actual para el contexto en ejecución (usado por el interceptor HTTP).
   */
  public getCurrentToken(): string | null {
    const session = getCurrentSession();
    if (session?.token) {
      return session.token;
    }
    if (session?.username) {
      const cached = this.userAuthCache.get(session.username.toLowerCase());
      if (cached && cached.tokenExpiresAt > Date.now()) {
        return cached.token;
      }
    }
    return this.defaultToken;
  }

  /**
   * Retorna la información de responsable en caché para el contexto activo.
   */
  public getCachedResponsible(): ResponsibleDto | null {
    const session = getCurrentSession();
    if (session?.responsibleInfo) {
      return session.responsibleInfo;
    }
    if (session?.username) {
      const cached = this.userAuthCache.get(session.username.toLowerCase());
      if (cached?.responsibleInfo) {
        return cached.responsibleInfo;
      }
    }
    return this.defaultResponsibleInfo;
  }

  /**
   * Obtiene dinámicamente el ID del responsable del usuario en contexto.
   */
  public getResponsibleId(): number {
    const info = this.getCachedResponsible();
    if (info && typeof info.id === 'number' && info.id > 0) {
      return info.id;
    }
    return env.DEFAULT_RESPONSIBLE_ID || 6;
  }

  /**
   * Obtiene dinámicamente el nombre completo del responsable en contexto.
   */
  public getResponsibleName(): string {
    const info = this.getCachedResponsible();
    if (info && info.fullName) {
      return info.fullName;
    }
    const session = getCurrentSession();
    if (session && session.username) {
      return session.username;
    }
    return env.DEFAULT_RESPONSIBLE_NAME || env.AUTH_USERNAME;
  }

  /**
   * Obtiene dinámicamente el ID del servicio asignado al usuario en contexto.
   */
  public getDefaultServiceId(): number {
    const info = this.getCachedResponsible();
    if (info && info.services && info.services.length > 0) {
      const primaryService = info.services[0];
      const sId = (primaryService as any)?.id || primaryService?.serviceId;
      if (typeof sId === 'number' && sId > 0) {
        return sId;
      }
    }
    return env.DEFAULT_SERVICE_ID || 4;
  }
}

export const authManager = new AuthManager();
