import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { env } from '../config/env.js';
import { MeetingSummaryDto } from '../types/openapi.js';
import { logger } from '../utils/logger.js';

export class MeetingService {
  /**
   * Consulta las reuniones programadas o concluidas en el sistema (100% LECTURA).
   */
  public async getMeetings(
    startDate?: string,
    endDate?: string,
    activityId?: number
  ): Promise<MeetingSummaryDto[]> {
    await authManager.getValidToken();

    try {
      logger.info('Consultando reuniones en la API...');
      const params: Record<string, any> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (activityId) params.activityId = activityId;

      const response = await apiClient.get<MeetingSummaryDto[]>('/api/v1/Meetings', { params });
      const meetings = response.data || [];
      logger.info(`Se obtuvieron ${meetings.length} reuniones.`);
      return meetings;
    } catch (error: any) {
      logger.error('Error al consultar reuniones:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Registra una nueva reunión en el sistema.
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async createMeeting(
    data: {
      title: string;
      description?: string;
      scheduledDate: string;
      durationMinutes?: number;
      location?: string;
      type?: number;
      attendeeIds?: number[];
      activityKey?: string;
    },
    dryRun = true
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de creación de reunión '${data.title}'.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: 'POST /api/v1/Meetings',
        simulatedMeetingId: Math.floor(Math.random() * 9000) + 1000,
        payloadPrepared: data,
        message: 'Validación de reunión exitosa. No se registraron cambios en producción (Modo Dry-Run).',
      };
    }

    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Ejecutando POST /api/v1/Meetings...`);
    const response = await apiClient.post('/api/v1/Meetings', data);
    return response.data;
  }

  /**
   * Actualiza el estado, título o notas de una reunión existente.
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async updateMeeting(
    id: number,
    data: {
      title?: string;
      description?: string;
      scheduledDate?: string;
      durationMinutes?: number;
      location?: string;
      type?: number;
      status?: number; // 0 = Scheduled, 1 = InProgress, 2 = Completed, 3 = Cancelled
      notes?: string;
      attendeeIds?: number[];
      activityKey?: string;
    },
    dryRun = true
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de actualización de reunión ${id}.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `PUT /api/v1/Meetings/${id}`,
        meetingId: id,
        updatedFields: data,
        message: `Validación de actualización de reunión ${id} exitosa. No se registraron cambios en producción (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Ejecutando PUT /api/v1/Meetings/${id}...`);
    const response = await apiClient.put(`/api/v1/Meetings/${id}`, data);
    return response.data;
  }

  /**
   * Elimina una reunión agendada o registrada en el sistema.
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async deleteMeeting(id: number, dryRun = true): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de eliminación de reunión ${id}.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `DELETE /api/v1/Meetings/${id}`,
        meetingId: id,
        message: `Validación de eliminación de reunión ${id} exitosa. No se registraron cambios en producción (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Ejecutando DELETE /api/v1/Meetings/${id}...`);
    const response = await apiClient.delete(`/api/v1/Meetings/${id}`);
    return {
      deleted: true,
      meetingId: id,
      targetEndpoint: `DELETE /api/v1/Meetings/${id}`,
      data: response.data,
      message: `Reunión ${id} eliminada permanentemente del sistema.`,
    };
  }
}

export const meetingService = new MeetingService();


