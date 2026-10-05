import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface IncidenciaDto {
  id: number;
  responsibleId: number;
  responsibleName?: string;
  type: string; // 'Asueto', 'Vacaciones', 'Permiso', 'Omisión', 'Incapacidad', etc.
  startDate: string;
  endDate: string;
  hours?: number | null;
  absenceHours?: number | null;
  notes?: string | null;
  createdAt?: string;
  createdBy?: string | null;
}

export interface CreateIncidenciaDto {
  responsibleId?: number;
  type: string;
  startDate: string;
  endDate: string;
  hours?: number | null;
  notes?: string | null;
}

export class IncidenceService {
  /**
   * Consulta las incidencias registradas en el sistema.
   */
  public async getIncidencias(
    responsibleId = 6,
    year?: number,
    month?: number
  ): Promise<IncidenciaDto[]> {
    await authManager.getValidToken();

    try {
      logger.info(`Consultando incidencias para el responsable ${responsibleId}...`);
      const params: Record<string, any> = { responsibleId };
      if (year) params.year = year;
      if (month) params.month = month;

      const response = await apiClient.get<IncidenciaDto[]>('/api/v1/Incidencias', { params });
      const items = response.data || [];
      logger.info(`Se obtuvieron ${items.length} incidencias.`);
      return items;
    } catch (error: any) {
      logger.error('Error al consultar incidencias:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Registra una nueva incidencia (Asueto, Vacaciones, Permiso, Omisión, etc.).
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run por defecto.
   */
  public async createIncidencia(
    data: CreateIncidenciaDto,
    dryRun = true
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    const payload = {
      responsibleId: data.responsibleId ?? 6,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      hours: data.hours ?? null,
      notes: data.notes ?? null
    };

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de creación de incidencia de tipo '${payload.type}'.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: 'POST /api/v1/Incidencias',
        simulatedIncidenciaId: Math.floor(Math.random() * 9000) + 1000,
        payloadPrepared: payload,
        message: `Validación de incidencia '${payload.type}' exitosa. No se registraron cambios en producción (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Ejecutando POST /api/v1/Incidencias...`);
    const response = await apiClient.post('/api/v1/Incidencias', payload);
    return response.data;
  }

  /**
   * Elimina una incidencia por su ID.
   */
  public async deleteIncidencia(id: number, dryRun = true): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de eliminación de incidencia ${id}.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `DELETE /api/v1/Incidencias/${id}`,
        incidenciaId: id,
        message: `Validación de eliminación de incidencia ${id} exitosa. No se registraron cambios en producción (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Ejecutando DELETE /api/v1/Incidencias/${id}...`);
    const response = await apiClient.delete(`/api/v1/Incidencias/${id}`);
    return response.data;
  }
}

export const incidenceService = new IncidenceService();
