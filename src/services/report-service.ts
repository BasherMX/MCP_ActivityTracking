import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { logger } from '../utils/logger.js';
import {
  DailyHoursReportDto,
  CapacityWorkloadReportDto,
  ProjectRepositoryDto,
} from '../types/report-and-collab.types.js';

export class ReportService {
  /**
   * Obtiene el reporte diario consolidado (actividades + etapas + reuniones) y faltantes de captura.
   */
  public async getDailyReport(params?: {
    startDate?: string;
    endDate?: string;
    today?: string;
    serviceIds?: string | number;
  }): Promise<DailyHoursReportDto> {
    await authManager.getValidToken();

    const now = new Date();
    const todayStr = params?.today || now.toISOString().split('T')[0];
    const startDateStr = params?.startDate || todayStr;
    const endDateStr = params?.endDate || todayStr;

    try {
      logger.info(`Consultando reporte diario consolidado desde ${startDateStr} hasta ${endDateStr}...`);
      const response = await apiClient.get<DailyHoursReportDto>('/api/v1/Reports/daily', {
        params: {
          startDate: startDateStr,
          endDate: endDateStr,
          today: todayStr,
          serviceIds: params?.serviceIds,
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Error al consultar reporte diario:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Obtiene el reporte de capacidad y carga de trabajo (mensual / semanal) con verificación de cumplimiento (>60%).
   */
  public async getCapacityWorkload(params?: {
    year?: number;
    month?: number;
    projectId?: number;
    responsibleId?: number;
  }): Promise<any> {
    await authManager.getValidToken();

    const now = new Date();
    const targetYear = params?.year || now.getFullYear();
    const targetMonth = params?.month || (now.getMonth() + 1);
    const targetResponsibleId = params?.responsibleId || authManager.getResponsibleId();

    try {
      logger.info(`Consultando capacidad y carga de trabajo para ${targetYear}-${targetMonth}...`);
      const response = await apiClient.get<CapacityWorkloadReportDto>('/api/v1/Reports/capacity-workload', {
        params: {
          year: targetYear,
          month: targetMonth,
          projectId: params?.projectId,
        },
      });

      const reportData = response.data;
      const personList = reportData.personCapacities || [];
      const person = personList.find(p => p.responsibleId === targetResponsibleId) || personList[0];

      // Cálculo de cumplimiento y alertas (umbral del 60%)
      let complianceAlert = 'NORMAL';
      let compliancePercentage = 0;

      if (person) {
        const nominalCapacity = person.monthlyCapacity || 160;
        const executed = person.hoursExecuted || 0;
        compliancePercentage = Math.round((executed / nominalCapacity) * 100);

        if (compliancePercentage < 60) {
          complianceAlert = `ALERTA: Cumplimiento por debajo del umbral mínimo institucional (${compliancePercentage}% de 60% esperado).`;
        } else {
          complianceAlert = `CUMPLIDO: Rendimiento adecuado (${compliancePercentage}% de capacidad).`;
        }
      }

      return {
        ...reportData,
        inspectedResponsibleId: targetResponsibleId,
        personSummary: person || null,
        compliancePercentage,
        complianceAlert,
      };
    } catch (error: any) {
      logger.error('Error al consultar capacidad y carga de trabajo:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Consulta los repositorios de código de un proyecto y la información CI/CD.
   */
  public async getProjectRepositories(projectId: number): Promise<ProjectRepositoryDto[]> {
    await authManager.getValidToken();

    try {
      logger.info(`Consultando repositorios para el proyecto ${projectId}...`);
      const response = await apiClient.get<ProjectRepositoryDto[]>(`/api/v1/projects/${projectId}/repositories`);
      return response.data || [];
    } catch (error: any) {
      logger.error(`Error al consultar repositorios del proyecto ${projectId}:`, error?.response?.data || error?.message);
      throw error;
    }
  }
}

export const reportService = new ReportService();
