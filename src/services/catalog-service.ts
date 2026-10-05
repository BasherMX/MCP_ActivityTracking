import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { ProjectDto, ServiceDto, ProductDto, CatalogItemDto, ResponsibleDto } from '../types/openapi.js';
import {
  FALLBACK_ACTIVITY_TYPES,
  FALLBACK_ACTIVITY_STATUSES,
  FALLBACK_ACTIVITY_PRIORITIES,
} from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class CatalogService {
  private projectsCache: ProjectDto[] | null = null;
  private servicesCache: ServiceDto[] | null = null;
  private responsiblesCache: ResponsibleDto[] | null = null;
  private cacheTimestamp: number = 0;
  private TTL = 5 * 60 * 1000; // 5 minutos de caché volátil en memoria

  /**
   * Obtiene la lista dinámica de proyectos activos en tiempo real desde la API.
   */
  public async getProjects(forceRefresh = false): Promise<ProjectDto[]> {
    const now = Date.now();
    if (!forceRefresh && this.projectsCache && now - this.cacheTimestamp < this.TTL) {
      return this.projectsCache;
    }

    await authManager.getValidToken();

    try {
      logger.info('Consultando proyectos activos dinámicamente desde /api/v1/Projects/active...');
      const response = await apiClient.get<ProjectDto[]>('/api/v1/Projects/active');
      if (response.data && Array.isArray(response.data)) {
        this.projectsCache = response.data;
        this.cacheTimestamp = now;
        logger.info(`Se obtuvieron ${response.data.length} proyectos activos dinámicos.`);
        return response.data;
      }
    } catch (error: any) {
      logger.warn('No se pudo consultar /Projects/active, intentando /Projects:', error.message);
      try {
        const fallbackRes = await apiClient.get<ProjectDto[]>('/api/v1/Projects');
        if (fallbackRes.data && Array.isArray(fallbackRes.data)) {
          this.projectsCache = fallbackRes.data;
          this.cacheTimestamp = now;
          return fallbackRes.data;
        }
      } catch (err: any) {
        logger.error('Error al consultar /Projects:', err.message);
      }
    }

    return this.projectsCache || [];
  }

  /**
   * Obtiene la lista dinámica de servicios en tiempo real desde la API.
   */
  public async getServices(forceRefresh = false): Promise<ServiceDto[]> {
    const now = Date.now();
    if (!forceRefresh && this.servicesCache && now - this.cacheTimestamp < this.TTL) {
      return this.servicesCache;
    }

    await authManager.getValidToken();

    try {
      logger.info('Consultando servicios dinámicamente desde /api/v1/Services...');
      const response = await apiClient.get<ServiceDto[]>('/api/v1/Services');
      if (response.data && Array.isArray(response.data)) {
        this.servicesCache = response.data;
        logger.info(`Se obtuvieron ${response.data.length} servicios dinámicos.`);
        return response.data;
      }
    } catch (error: any) {
      logger.error('Error al consultar /Services:', error.message);
    }

    return this.servicesCache || [];
  }

  /**
   * Obtiene la lista dinámica de productos y entregables.
   */
  public async getProducts(): Promise<ProductDto[]> {
    await authManager.getValidToken();

    try {
      const response = await apiClient.get<ProductDto[]>('/api/v1/Products');
      return response.data || [];
    } catch (error: any) {
      logger.warn('Error al consultar /Products:', error.message);
      return [];
    }
  }

  /**
   * Obtiene la lista dinámica de Sprints desde la API.
   */
  public async getSprints(projectId?: number): Promise<any[]> {
    await authManager.getValidToken();

    try {
      const response = await apiClient.get<any[]>('/api/v1/Sprints');
      let sprints = response.data || [];
      if (projectId) {
        sprints = sprints.filter((s) => s.projectId === projectId);
      }
      return sprints;
    } catch (error: any) {
      logger.error('Error al consultar /Sprints:', error.message);
      return [];
    }
  }

  /**
   * Obtiene dinámicamente el último Sprint activo para un proyecto.
   */
  public async getLatestSprintForProject(projectId: number): Promise<any | null> {
    const sprints = await this.getSprints(projectId);
    if (!sprints || sprints.length === 0) {
      return null;
    }

    // Ordenar por ID descendente o por fecha de inicio para obtener el más reciente
    sprints.sort((a, b) => {
      const idA = a.id || 0;
      const idB = b.id || 0;
      return idB - idA;
    });

    logger.info(`Último sprint dinámico encontrado para proyecto ${projectId}: ID ${sprints[0].id} (${sprints[0].name || sprints[0].sprintName || 'Sprint'})`);
    return sprints[0];
  }

  /**
   * Consulta tipos de actividad dinámicos.
   */
  public async getActivityTypes(): Promise<string[]> {
    await authManager.getValidToken();

    try {
      const response = await apiClient.get<CatalogItemDto[]>('/api/v1/catalogs/activity-types');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((item) => item.name || item.displayName || 'Development');
      }
    } catch {
      // Ignorar fallo y usar fallback
    }

    return [...FALLBACK_ACTIVITY_TYPES];
  }

  /**
   * Consulta estados dinámicos.
   */
  public async getActivityStatuses(): Promise<string[]> {
    await authManager.getValidToken();

    try {
      const response = await apiClient.get<CatalogItemDto[]>('/api/v1/catalogs/activity-statuses');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((item) => item.name || item.displayName || 'Pending');
      }
    } catch {
      // Ignorar fallo y usar fallback
    }

    return [...FALLBACK_ACTIVITY_STATUSES];
  }

  /**
   * Consulta prioridades dinámicas.
   */
  public async getActivityPriorities(): Promise<string[]> {
    await authManager.getValidToken();

    try {
      const response = await apiClient.get<CatalogItemDto[]>('/api/v1/catalogs/activity-priorities');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((item) => item.name || item.displayName || 'Medium');
      }
    } catch {
      // Ignorar fallo y usar fallback
    }

    return [...FALLBACK_ACTIVITY_PRIORITIES];
  }

  /**
   * Obtiene la lista de responsables en el sistema (docentes, enlaces, desarrolladores, etc.).
   */
  public async getResponsibles(forceRefresh = false): Promise<ResponsibleDto[]> {
    const now = Date.now();
    if (!forceRefresh && this.responsiblesCache && now - this.cacheTimestamp < this.TTL) {
      return this.responsiblesCache;
    }

    await authManager.getValidToken();

    try {
      logger.info('Consultando responsables dinámicamente desde /api/v1/Responsibles/active...');
      const response = await apiClient.get<ResponsibleDto[]>('/api/v1/Responsibles/active');
      if (response.data && Array.isArray(response.data)) {
        this.responsiblesCache = response.data;
        logger.info(`Se obtuvieron ${response.data.length} responsables activos.`);
        return response.data;
      }
    } catch {
      try {
        const fallbackRes = await apiClient.get<ResponsibleDto[]>('/api/v1/Responsibles');
        if (fallbackRes.data && Array.isArray(fallbackRes.data)) {
          this.responsiblesCache = fallbackRes.data;
          return fallbackRes.data;
        }
      } catch (err: any) {
        logger.warn('Error al consultar /Responsibles:', err.message);
      }
    }

    // Fallback: al menos incluir el usuario autenticado
    const authUser = authManager.getCachedResponsible();
    if (authUser) {
      this.responsiblesCache = [authUser];
    } else {
      this.responsiblesCache = [{
        id: authManager.getResponsibleId(),
        fullName: authManager.getResponsibleName(),
        active: true,
      }];
    }
    return this.responsiblesCache;
  }

  /**
   * Resumen completo y dinámico de todos los catálogos para contexto del LLM.
   */
  public async getAllCatalogsSummary(): Promise<any> {
    const [projects, services, products, responsibles, activityTypes, activityStatuses, activityPriorities] = await Promise.all([
      this.getProjects(),
      this.getServices(),
      this.getProducts(),
      this.getResponsibles(),
      this.getActivityTypes(),
      this.getActivityStatuses(),
      this.getActivityPriorities(),
    ]);

    return {
      projectsCount: projects.length,
      projects: projects.map((p) => ({ id: p.id, name: p.name, prefix: p.prefix })),
      servicesCount: services.length,
      services: services.map((s) => ({ id: s.id, name: s.name })),
      productsCount: products.length,
      responsiblesCount: responsibles.length,
      responsibles: responsibles.map((r) => ({ id: r.id, fullName: r.fullName, username: r.username })),
      activityTypes,
      activityStatuses,
      activityPriorities,
    };
  }
}

export const catalogService = new CatalogService();
