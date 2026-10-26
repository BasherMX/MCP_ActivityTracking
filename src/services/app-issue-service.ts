import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  AppIssueDto,
  CreateAppIssueDto,
  UpdateAppIssueStatusDto,
  AppIssueFilterParams,
} from '../types/app-issue.types.js';

export class AppIssueService {
  /**
   * Consulta la lista de fallas técnicas o bugs de la aplicación.
   */
  public async getAppIssues(params?: AppIssueFilterParams): Promise<AppIssueDto[]> {
    await authManager.getValidToken();

    try {
      logger.info('Consultando lista de AppIssues en la API...');
      const response = await apiClient.get<AppIssueDto[]>('/api/v1/AppIssues', {
        params: {
          status: params?.status,
          severity: params?.severity,
          reportedById: params?.reportedById,
        },
      });
      return response.data || [];
    } catch (error: any) {
      logger.error('Error al consultar AppIssues:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Consulta el detalle de un AppIssue por su ID.
   */
  public async getAppIssueById(id: number): Promise<AppIssueDto> {
    await authManager.getValidToken();

    try {
      logger.info(`Consultando detalle de AppIssue ${id}...`);
      const response = await apiClient.get<AppIssueDto>(`/api/v1/AppIssues/${id}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error al consultar AppIssue ${id}:`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Reporta un nuevo error, falla o bug en el sistema.
   * SEGURIDAD: Interceptado en modo Dry-Run por defecto.
   */
  public async reportAppIssue(
    data: CreateAppIssueDto,
    dryRun = true,
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;
    const currentResponsibleId = authManager.getResponsibleId();
    const currentResponsibleName = authManager.getResponsibleName();

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de reporte de AppIssue: '${data.title}'.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: 'POST /api/v1/AppIssues',
        reportedIssue: {
          title: data.title,
          description: data.description,
          severity: data.severity,
          pageUrl: data.pageUrl,
          reportedById: currentResponsibleId,
          reportedByName: currentResponsibleName,
          status: 'Open',
        },
        message: `Simulación exitosa: Issue '${data.title}' validado con severidad '${data.severity}'. Base de datos intacta (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Creando nuevo AppIssue: '${data.title}'...`);

    const formData = new FormData();
    formData.append('Title', data.title);
    formData.append('Description', data.description);
    formData.append('Severity', data.severity);
    if (data.pageUrl) formData.append('PageUrl', data.pageUrl);
    if (data.userAgent) formData.append('UserAgent', data.userAgent);

    if (data.fileBuffer && data.fileName) {
      const blob = new Blob([data.fileBuffer], { type: data.contentType || 'application/octet-stream' });
      formData.append('File', blob, data.fileName);
    }

    const response = await apiClient.post<AppIssueDto>('/api/v1/AppIssues', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  /**
   * Actualiza el estado y notas de resolución de un AppIssue.
   */
  public async updateAppIssueStatus(
    id: number,
    data: UpdateAppIssueStatusDto,
    dryRun = true,
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de cambio de estado a '${data.status}' para AppIssue ${id}.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `PUT /api/v1/AppIssues/${id}/status`,
        issueId: id,
        newStatus: data.status,
        resolutionNotes: data.resolutionNotes,
        message: `Simulación exitosa: Estado de issue ${id} actualizado a '${data.status}'. Base de datos intacta.`,
      };
    }

    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Actualizando estado de AppIssue ${id} a '${data.status}'...`);

    const response = await apiClient.put<AppIssueDto>(`/api/v1/AppIssues/${id}/status`, data);
    return response.data;
  }
}

export const appIssueService = new AppIssueService();
