import { AsyncLocalStorage } from 'node:async_hooks';
import { ResponsibleDto } from '../types/openapi.js';

export interface UserSession {
  sessionId: string;
  username: string;
  password?: string;
  token?: string;
  tokenExpiresAt?: number;
  responsibleInfo?: ResponsibleDto | null;
  lastActiveAt: number;
}

export const sessionAsyncStorage = new AsyncLocalStorage<UserSession>();

/**
 * Retorna la sesión de usuario activa en el contexto asíncrono actual.
 */
export function getCurrentSession(): UserSession | undefined {
  return sessionAsyncStorage.getStore();
}

/**
 * Ejecuta una función dentro del contexto asíncrono de una sesión de usuario.
 */
export function runInSession<T>(session: UserSession, fn: () => T | Promise<T>): T | Promise<T> {
  return sessionAsyncStorage.run(session, fn);
}

class SessionManager {
  private sessions = new Map<string, UserSession>();

  /**
   * Obtiene una sesión existente o crea una nueva asociada al sessionId de transporte.
   */
  public getOrCreateSession(sessionId: string, username = '', password = ''): UserSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        username,
        password,
        lastActiveAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    } else {
      if (username) session.username = username;
      if (password) session.password = password;
      session.lastActiveAt = Date.now();
    }
    return session;
  }

  public getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public getActiveCount(): number {
    return this.sessions.size;
  }

  public cleanupInactiveSessions(maxIdleMs = 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActiveAt > maxIdleMs) {
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionManager = new SessionManager();
