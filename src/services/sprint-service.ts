import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { catalogService } from './catalog-service.js';
import { WorkItemDto, SprintSyncResultDto, WorkItemSyncResultDto } from '../types/openapi.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class SprintService {
  /**
   * Consulta los work items asociados a un sprint en tiempo real.
   * Si no se especifica sprintId, resuelve DINÁMICAMENTE el último sprint del proyecto.
   * Operación 100% de LECTURA segura.
   */
  public async getSprintWorkItems(
    sprintId?: number,
    projectId = env.DEFAULT_PROJECT_ID,
    assignedToFilter?: string
  ): Promise<{ sprintInfo: any; workItems: WorkItemDto[] }> {
    await authManager.getValidToken();

    let targetSprintId = sprintId;
    let sprintInfo: any = null;

    // Si no enviaron sprintId específico, resolver dinámicamente el último sprint del proyecto
    if (!targetSprintId || targetSprintId === 0) {
      sprintInfo = await catalogService.getLatestSprintForProject(projectId);
      if (sprintInfo) {
        targetSprintId = sprintInfo.id;
      }
    }

    if (!targetSprintId) {
      logger.warn(`No se encontró un sprint para el proyecto ${projectId}.`);
      return { sprintInfo: null, workItems: [] };
    }

    try {
      logger.info(`Consultando work items del Sprint ${targetSprintId} dinámicamente...`);
      const response = await apiClient.get<WorkItemDto[]>(`/api/v1/Sprints/${targetSprintId}/work-items`);
      let items = response.data || [];

      if (assignedToFilter && assignedToFilter.trim()) {
        const query = assignedToFilter.toLowerCase().trim();
        items = items.filter((item) => item.assignedTo?.toLowerCase().includes(query));
      }

      logger.info(`Se obtuvieron ${items.length} work items del Sprint ${targetSprintId}.`);
      return {
        sprintInfo: sprintInfo || { id: targetSprintId },
        workItems: items,
      };
    } catch (error: any) {
      logger.error(`Error al consultar work items del Sprint ${targetSprintId}:`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Sincroniza dinámicamente los Sprints y Work Items de un proyecto con Azure DevOps / GitLab.
   */
  public async syncSprintsByProject(projectId = env.DEFAULT_PROJECT_ID): Promise<SprintSyncResultDto> {
    await authManager.getValidToken();

    try {
      logger.info(`Sincronizando sprints para el proyecto ${projectId} dinámicamente...`);
      const response = await apiClient.post<SprintSyncResultDto>(`/api/v1/Sprints/sync/${projectId}`);
      logger.info(`Sincronización de sprints completada:`, JSON.stringify(response.data));
      return response.data;
    } catch (error: any) {
      logger.error(`Error al sincronizar sprints del proyecto ${projectId}:`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Sincroniza dinámicamente los Work Items de un Sprint específico desde Azure DevOps.
   */
  public async syncWorkItemsBySprint(sprintId: number): Promise<WorkItemSyncResultDto> {
    await authManager.getValidToken();

    try {
      logger.info(`Sincronizando work items del Sprint ${sprintId}...`);
      const response = await apiClient.post<WorkItemSyncResultDto>(`/api/v1/Sprints/${sprintId}/work-items/sync`);
      logger.info(`Sincronización de work items completada:`, JSON.stringify(response.data));
      return response.data;
    } catch (error: any) {
      logger.error(`Error al sincronizar work items del sprint ${sprintId}:`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Ejecuta la sincronización completa y dinámica del último sprint de un proyecto.
   */
  public async syncLatestSprintForProject(projectId = env.DEFAULT_PROJECT_ID, explicitSprintId?: number): Promise<any> {
    // 1. Sincronizar Sprints del proyecto
    const resSprints = await this.syncSprintsByProject(projectId);

    // 2. Resolver el ID del sprint a sincronizar
    let targetSprintId = explicitSprintId;
    if (!targetSprintId) {
      const latest = await catalogService.getLatestSprintForProject(projectId);
      if (latest) {
        targetSprintId = latest.id;
      }
    }

    let resWorkItems: WorkItemSyncResultDto | null = null;
    if (targetSprintId) {
      resWorkItems = await this.syncWorkItemsBySprint(targetSprintId);
    }

    return {
      projectId,
      sprintId: targetSprintId,
      sprintsSync: resSprints,
      workItemsSync: resWorkItems,
      message: `Sincronización dinámica completada exitosamente.`,
    };
  }
}

export const sprintService = new SprintService();
