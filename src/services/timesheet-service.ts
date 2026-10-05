import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { env } from '../config/env.js';
import { CreateStageWorkEntryDto, ResponsibleDto } from '../types/openapi.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { logger } from '../utils/logger.js';

export class TimesheetService {
  /**
   * Consulta las horas acumuladas por un responsable en un rango de fechas (100% LECTURA).
   */
  public async getHoursByResponsible(
    responsibleId?: number,
    from?: string,
    to?: string
  ): Promise<number> {
    await authManager.getValidToken();
    const targetResponsibleId = responsibleId || authManager.getResponsibleId();

    try {
      logger.info(`Consultando horas acumuladas para responsable ${targetResponsibleId} entre ${from} y ${to}...`);
      const response = await apiClient.get<number>('/api/v1/stage-work-entries/hours-by-responsible', {
        params: { responsibleId: targetResponsibleId, from, to },
      });
      return Number(response.data) || 0;
    } catch (error: any) {
      logger.error('Error al consultar horas por responsable:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Calcula el balance de trabajo semanal y mensual respecto a la capacidad institucional (100% LECTURA).
   */
  public async getWorkBalanceMetrics(
    responsibleId?: number,
    period: 'today' | 'current_week' | 'current_month' | 'custom' = 'current_week',
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    await authManager.getValidToken();
    const targetResponsibleId = responsibleId || authManager.getResponsibleId();


    const now = new Date();
    let fromIso = '';
    let toIso = '';

    if (period === 'today') {
      fromIso = format(now, 'yyyy-MM-dd');
      toIso = format(now, 'yyyy-MM-dd');
    } else if (period === 'current_week') {
      fromIso = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      toIso = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else if (period === 'current_month') {
      fromIso = format(startOfMonth(now), 'yyyy-MM-dd');
      toIso = format(endOfMonth(now), 'yyyy-MM-dd');
    } else {
      fromIso = startDate ? format(new Date(startDate), 'yyyy-MM-dd') : format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      toIso = endDate ? format(new Date(endDate), 'yyyy-MM-dd') : format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    }

    // 1. Consultar horas laboradas en el periodo
    const hoursWorkedInPeriod = await this.getHoursByResponsible(targetResponsibleId, fromIso, toIso);

    // 2. Consultar capacidad mensual del responsable
    let monthlyCapacity = 160; // Capacidad estándar por defecto
    try {
      const respInfo = await apiClient.get<ResponsibleDto>(`/api/v1/Responsibles/${targetResponsibleId}`);
      if (respInfo.data && respInfo.data.monthlyCapacity) {
        monthlyCapacity = respInfo.data.monthlyCapacity;
      }
    } catch {
      // Usar capacidad por defecto si falla la llamada
    }

    const weeklyCapacityTarget = monthlyCapacity / 4;
    const isWeek = period === 'current_week';
    const target = isWeek ? weeklyCapacityTarget : monthlyCapacity;
    const remaining = Math.max(0, target - hoursWorkedInPeriod);
    const progressPercent = Math.min(100, Math.round((hoursWorkedInPeriod / target) * 100));

    return {
      responsibleId: targetResponsibleId,
      period,
      from: fromIso,
      to: toIso,
      hoursWorkedInPeriod,
      targetCapacity: target,
      monthlyCapacityTotal: monthlyCapacity,
      remainingHoursToTarget: remaining,
      progressPercentage: progressPercent,
      isTargetMet: hoursWorkedInPeriod >= target,
    };
  }

  /**
   * Registra horas de trabajo en una etapa de actividad.
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async logWorkHours(
    data: CreateStageWorkEntryDto & { activityId?: number; stageProgressId?: number },
    dryRun = true
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;
    const activeRespId = data.responsibleId || authManager.getResponsibleId();

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de captura de horas de trabajo.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `/api/v1/stage-work-entries/by-progress/${data.stageProgressId || 'AUTO_RESOLVED'}`,
        simulatedEntry: {
          hoursWorked: data.hoursWorked,
          workDate: data.workDate,
          notes: data.notes,
          responsibleId: activeRespId,
          activityId: data.activityId,
        },
        message: `Simulación exitosa: ${data.hoursWorked} horas preparadas para registro. Base de datos productiva intacta.`,
      };
    }

    await authManager.getValidToken();
    const stageId = data.stageProgressId;
    if (!stageId) {
      throw new Error('stageProgressId es requerido para el registro en modo real.');
    }

    const response = await apiClient.post(`/api/v1/stage-work-entries/by-progress/${stageId}`, {
      responsibleId: activeRespId,
      workDate: data.workDate,
      hoursWorked: data.hoursWorked,
      notes: data.notes,
    });
    return response.data;
  }
}

export const timesheetService = new TimesheetService();
