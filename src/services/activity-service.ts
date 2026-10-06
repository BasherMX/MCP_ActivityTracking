import { apiClient } from "./api-client.js";
import { authManager } from "./auth-manager.js";
import { env } from "../config/env.js";
import {
  ActivityListDto,
  ActivityDto,
  CreateActivityDto,
  UpdateActivityDto,
  AdHocStageProgressDto,
} from "../types/openapi.js";
import { catalogService } from "./catalog-service.js";
import { logger } from "../utils/logger.js";

export class ActivityService {
  /**
   * Consulta las actividades asignadas a un responsable (100% LECTURA).
   */
  public async getMyActivities(
    responsibleId?: number,
    statusFilter?: string,
    projectIdFilter?: number,
  ): Promise<ActivityListDto[]> {
    await authManager.getValidToken();
    const targetResponsibleId = responsibleId || authManager.getResponsibleId();

    try {
      logger.info(
        `Consultando actividades asignadas al responsable ${targetResponsibleId}...`,
      );
      const response = await apiClient.get<ActivityListDto[]>(
        `/api/v1/Activities/by-responsible/${targetResponsibleId}`,
      );
      let activities = response.data || [];

      if (statusFilter && statusFilter !== "All") {
        const query = statusFilter.toLowerCase();
        activities = activities.filter(
          (a) => a.status?.toLowerCase() === query,
        );
      }

      if (projectIdFilter) {
        const projects = await catalogService.getProjects();
        const project = projects.find((p: any) => p.id === projectIdFilter);
        if (project?.name) {
          const queryName = project.name.toLowerCase();
          activities = activities.filter((a) =>
            a.projectName?.toLowerCase().includes(queryName),
          );
        }
      }

      logger.info(`Se recuperaron ${activities.length} actividades.`);
      return activities;
    } catch (error: any) {
      logger.error(
        "Error al consultar actividades por responsable:",
        error?.response?.data || error?.message,
      );
      throw error;
    }
  }

  private allActivitiesCache: (ActivityListDto & { responsibleName?: string })[] | null = null;
  private allActivitiesTimestamp = 0;
  private readonly CACHE_TTL = 30 * 1000; // 30 segundos

  /**
   * Obtiene todas las actividades del sistema en memoria con caché rápido (30s).
   */
  public async getAllActivities(forceRefresh = false): Promise<(ActivityListDto & { responsibleName?: string })[]> {
    const now = Date.now();
    if (!forceRefresh && this.allActivitiesCache && now - this.allActivitiesTimestamp < this.CACHE_TTL) {
      return this.allActivitiesCache;
    }

    await authManager.getValidToken();
    const responsibles = await catalogService.getResponsibles();

    const allActs: (ActivityListDto & { responsibleName?: string })[] = [];
    await Promise.all(
      responsibles.map(async (resp) => {
        try {
          const res = await apiClient.get<ActivityListDto[]>(`/api/v1/Activities/by-responsible/${resp.id}`);
          const acts = res.data || [];
          for (const act of acts) {
            allActs.push({
              ...act,
              responsibleName: resp.fullName || act.responsibleName || 'Desconocido',
            });
          }
        } catch {}
      })
    );

    this.allActivitiesCache = allActs;
    this.allActivitiesTimestamp = now;
    return allActs;
  }

  /**
   * Resuelve un identificador de actividad (numérico 9758 o clave 'CI095', 'G114', 'actividad G114') a su ID numérico real.
   */
  public async resolveNumericActivityId(
    identifier: number | string,
  ): Promise<number> {
    if (typeof identifier === "number") {
      return identifier;
    }
    const rawStr = String(identifier).trim();
    if (/^\d+$/.test(rawStr)) {
      return parseInt(rawStr, 10);
    }

    // Extraer clave de actividad (ej. de "actividad G114" o "G-114" o "CI095" -> "G114", "CI095")
    const keyMatch = rawStr.match(/\b([A-Za-z]{1,5}[-_]?\d{1,5})\b/);
    const targetKey = keyMatch ? keyMatch[1] : rawStr;
    const cleanKey = targetKey.toUpperCase().replace(/[-_]/g, "");

    const allActivities = await this.getAllActivities();

    // 1. Coincidencia exacta por clave de actividad
    const exactMatch = allActivities.find((a) => {
      const actKeyClean = a.activityId?.toUpperCase().replace(/[-_]/g, "") || "";
      return actKeyClean === cleanKey || a.activityId?.toUpperCase() === targetKey.toUpperCase();
    });
    if (exactMatch) return exactMatch.id;

    // 2. Coincidencia por ID numérico en texto
    const numMatch = rawStr.match(/\b(\d{3,6})\b/);
    if (numMatch) {
      const targetId = parseInt(numMatch[1], 10);
      const byId = allActivities.find((a) => a.id === targetId);
      if (byId) return byId.id;
    }

    // 3. Coincidencia parcial si contiene el número de clave (ej. "114")
    const partialMatch = allActivities.find((a) => {
      const actKeyClean = a.activityId?.toUpperCase().replace(/[-_]/g, "") || "";
      return actKeyClean.includes(cleanKey) || cleanKey.includes(actKeyClean);
    });
    if (partialMatch) return partialMatch.id;

    throw new Error(
      `No se encontró la actividad '${identifier}' (clave: '${targetKey}') en el sistema.`,
    );
  }

  /**
   * Buscador global de actividades por clave, descripción o texto libre en todo el sistema.
   */
  public async searchActivities(
    query?: string,
    responsibleName?: string,
    statusFilter?: string,
    limit = 20,
  ): Promise<any[]> {
    const allActivities = await this.getAllActivities();

    const rawQuery = (query || "").trim().toLowerCase();
    const keyMatch = (query || "").match(/\b([A-Za-z]{1,5}[-_]?\d{1,5})\b/i);
    const candidateKey = keyMatch ? keyMatch[1].toUpperCase().replace(/[-_]/g, "") : null;
    const numMatch = (query || "").match(/\b(\d{2,6})\b/);
    const candidateNum = numMatch ? numMatch[1] : null;

    // Palabras clave ignorando conectores
    const stopWords = new Set(["la", "el", "los", "las", "un", "una", "de", "del", "en", "para", "por", "esta", "este", "actividad", "tarea"]);
    const queryTokens = rawQuery
      .split(/[\s,.-]+/)
      .filter((w) => w.length > 0 && !stopWords.has(w));

    const qResp = responsibleName ? responsibleName.toLowerCase().trim() : null;

    const scored: { act: any; score: number }[] = [];

    for (const act of allActivities) {
      if (statusFilter && statusFilter !== "All" && act.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        continue;
      }

      if (qResp) {
        const respText = (act.responsibleName || "").toLowerCase();
        if (!respText.includes(qResp)) continue;
      }

      if (!query || rawQuery === "") {
        scored.push({ act, score: 1 });
        continue;
      }

      const actKey = act.activityId ? act.activityId.toUpperCase().replace(/[-_]/g, "") : "";
      const actKeyRaw = (act.activityId || "").toLowerCase();
      const desc = (act.description || "").toLowerCase();
      const proj = (act.projectName || "").toLowerCase();
      const idStr = String(act.id);

      let score = 0;

      // Coincidencia exacta de clave (máxima relevancia)
      if (candidateKey && actKey === candidateKey) {
        score += 100;
      } else if (candidateKey && actKey.includes(candidateKey)) {
        score += 50;
      }

      // Coincidencia de ID numérico
      if (candidateNum && idStr === candidateNum) {
        score += 80;
      } else if (candidateNum && actKeyRaw.includes(candidateNum)) {
        score += 60;
      }

      // Coincidencia de tokens
      for (const token of queryTokens) {
        if (actKeyRaw.includes(token)) score += 40;
        if (desc.includes(token)) score += 20;
        if (proj.includes(token)) score += 10;
      }

      if (score > 0) {
        scored.push({ act, score });
      }
    }

    // Ordenar de mayor a menor relevancia
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.act);
  }

  /**
   * Obtiene el detalle completo de una actividad por su ID numérico o clave (100% LECTURA).
   */
  public async getActivityDetail(
    idOrKey: number | string,
  ): Promise<ActivityDto> {
    const id = await this.resolveNumericActivityId(idOrKey);
    await authManager.getValidToken();

    try {
      logger.info(`Consultando detalle de la actividad ${id}...`);
      const response = await apiClient.get<ActivityDto>(
        `/api/v1/Activities/${id}`,
      );
      return response.data;
    } catch (error: any) {
      logger.error(
        `Error al consultar detalle de la actividad ${id}:`,
        error?.response?.data || error?.message,
      );
      throw error;
    }
  }

  /**
   * Obtiene las etapas de avance de una actividad (100% LECTURA).
   */
  public async getActivityStages(
    activityId: number,
  ): Promise<AdHocStageProgressDto[]> {
    await authManager.getValidToken();

    try {
      const response = await apiClient.get<AdHocStageProgressDto[]>(
        `/api/v1/activities/${activityId}/stages/progress`,
      );
      return response.data || [];
    } catch (error: any) {
      logger.error(
        `Error al consultar etapas de la actividad ${activityId}:`,
        error?.response?.data || error?.message,
      );
      throw error;
    }
  }

  /**
   * Registra una nueva actividad.
   * SEGURIDAD EN PRODUCCIÓN: Si dryRun es true o DRY_RUN_MODE está activo,
   * intercepta la petición y devuelve un resultado simulado sin escribir en la BD.
   */
  public async createActivity(
    data: CreateActivityDto,
    dryRun = true,
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    // Autocompletar responsibleId y serviceId dinámicamente si no fueron especificados
    if (!data.responsibleId) {
      data.responsibleId = authManager.getResponsibleId();
    }
    if (!data.serviceId) {
      data.serviceId = authManager.getDefaultServiceId();
    }

    if (!isDryRun && !data.productId) {
      throw new Error(
        "No se puede registrar una actividad en producción sin productId. Selecciona un producto para habilitar el seguimiento por etapas.",
      );
    }

    if (data.productId) {
      const products = await catalogService.getProducts();
      const product = products.find((item) => item.id === data.productId);
      if (!product) {
        throw new Error(
          `El producto ${data.productId} no existe en el catálogo activo.`,
        );
      }
      if (
        product.serviceId &&
        data.serviceId &&
        product.serviceId !== data.serviceId
      ) {
        throw new Error(
          `El producto ${data.productId} pertenece al servicio ${product.serviceId}, no al servicio ${data.serviceId}.`,
        );
      }
    }

    const projects = await catalogService.getProjects();
    const services = await catalogService.getServices();
    const projectName =
      projects.find((p: any) => p.id === data.projectId)?.name || "Desconocido";
    const serviceName =
      services.find((s: any) => s.id === data.serviceId)?.name || "Desconocido";

    if (isDryRun) {
      logger.warn(
        `[DRY-RUN INTERCEPTOR] Simulación de creación de actividad activa.`,
      );
      logger.info(`[DRY-RUN PAYLOAD]:`, JSON.stringify(data, null, 2));

      return {
        dryRun: true,
        status: "SIMULATION_SUCCESS",
        targetEndpoint: "POST /api/v1/Activities",
        simulatedActivityId: Math.floor(Math.random() * 9000) + 1000,
        resolvedMetadata: {
          projectId: data.projectId,
          projectName,
          serviceId: data.serviceId,
          serviceName,
          type: data.type,
          priority: data.priority,
          responsibleId: data.responsibleId,
          estimatedHours: data.estimatedHours,
          status: data.status || "InProgress",
        },
        payloadPrepared: data,
        message:
          "Validación de esquema y lógica exitosa. No se registraron datos en la base productiva (Modo Dry-Run).",
      };
    }

    // Modo real (deshabilitado por defecto para proteger la BD productiva)
    await authManager.getValidToken();
    logger.info(`[PRODUCCIÓN REAL] Ejecutando POST /api/v1/Activities...`);
    const response = await apiClient.post<ActivityDto>(
      "/api/v1/Activities",
      data,
    );
    return response.data;
  }

  /**
   * Actualiza el avance, estado o campos de una actividad (permite actividades de cualquier responsable).
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async updateActivity(
    idOrKey: number | string,
    data: UpdateActivityDto,
    dryRun = true,
  ): Promise<any> {
    const id = await this.resolveNumericActivityId(idOrKey);
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(
        `[DRY-RUN INTERCEPTOR] Simulación de actualización de actividad ${id}.`,
      );
      logger.info(`[DRY-RUN PAYLOAD]:`, JSON.stringify(data, null, 2));

      return {
        dryRun: true,
        status: "SIMULATION_SUCCESS",
        targetEndpoint: `PUT /api/v1/Activities/${id}`,
        activityId: id,
        updatedFields: data,
        message: `Validación exitosa para actualizar la actividad ${id}. No se realizaron cambios en producción (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    let payload: any = { ...data };
    try {
      const existing = await this.getActivityDetail(id);
      payload = {
        ...existing,
        ...data,
      };
    } catch (err: any) {
      logger.warn(
        `No se pudo obtener el detalle previo de la actividad ${id}, enviando payload directo:`,
        err.message,
      );
    }
    const response = await apiClient.put<ActivityDto>(
      `/api/v1/Activities/${id}`,
      payload,
    );
    return response.data;
  }

  /**
   * Cierra una actividad al 100% y estado Completed.
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async closeActivity(
    idOrKey: number | string,
    actualHours?: number,
    completionNotes?: string,
    dryRun = true,
  ): Promise<any> {
    const id = await this.resolveNumericActivityId(idOrKey);
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;
    const nowIso = new Date().toISOString();

    const updatePayload: UpdateActivityDto = {
      status: "Completed",
      progressPercentage: 100,
      actualCompletionDate: nowIso,
      notes: completionNotes,
    };

    if (isDryRun) {
      logger.warn(
        `[DRY-RUN INTERCEPTOR] Simulación de cierre de actividad ${id}.`,
      );
      return {
        dryRun: true,
        status: "SIMULATION_SUCCESS",
        targetEndpoint: `PUT /api/v1/Activities/${id} (Cierre)`,
        activityId: id,
        actualHoursReported: actualHours,
        appliedChanges: updatePayload,
        message: `Simulación de cierre completada al 100% para actividad ${id}. Base de datos intacta.`,
      };
    }

    await authManager.getValidToken();
    const existing = await this.getActivityDetail(id);
    const response = await apiClient.put<ActivityDto>(
      `/api/v1/Activities/${id}`,
      {
        ...existing,
        ...updatePayload,
      },
    );
    return response.data;
  }

  /**
   * Consulta las etapas de proceso configuradas para un producto.
   */
  public async getProcessStagesByProduct(productId: number): Promise<any[]> {
    await authManager.getValidToken();
    try {
      const response = await apiClient.get(
        `/api/v1/process-stages/by-product/${productId}`,
      );
      return response.data || [];
    } catch (error: any) {
      logger.error(
        `Error al consultar etapas del producto ${productId}:`,
        error.message,
      );
      return [];
    }
  }

  /**
   * Consulta el historial de etapas recorridas por una actividad.
   */
  public async getProcessStageHistory(activityId: number): Promise<any[]> {
    await authManager.getValidToken();
    try {
      const response = await apiClient.get(
        `/api/v1/process-stages/activity/${activityId}/history`,
      );
      return response.data || [];
    } catch (error: any) {
      logger.error(
        `Error al consultar historial de etapas para actividad ${activityId}:`,
        error.message,
      );
      return [];
    }
  }

  /**
   * Avanza una actividad a una nueva etapa del proceso.
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async advanceProcessStage(
    activityId: number,
    stageId: number,
    assignedToId = env.DEFAULT_RESPONSIBLE_ID,
    notes?: string,
    dryRun = true,
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(
        `[DRY-RUN INTERCEPTOR] Simulación de avance de etapa para actividad ${activityId}.`,
      );
      return {
        dryRun: true,
        status: "SIMULATION_SUCCESS",
        targetEndpoint: `POST /api/v1/process-stages/activity/${activityId}/advance`,
        activityId,
        stageId,
        assignedToId,
        notes,
        message: `Simulación exitosa: Avance a etapa ${stageId} preparado. No se modificó la base de datos (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.info(
      `[PRODUCCIÓN REAL] Avanzando actividad ${activityId} a la etapa ${stageId}...`,
    );
    const response = await apiClient.post(
      `/api/v1/process-stages/activity/${activityId}/advance`,
      {
        stageId,
        assignedToId,
        notes,
      },
    );
    return response.data;
  }

  /**
   * Avanza secuencialmente TODAS las etapas pendientes de una actividad hasta la etapa final.
   */
  public async advanceAllProcessStages(
    activityId: number,
    assignedToId = env.DEFAULT_RESPONSIBLE_ID,
    notes?: string,
    dryRun = true,
    productId?: number,
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;
    logger.info(
      `Avanzando automáticamente todas las etapas para la actividad ${activityId}...`,
    );

    let stages: any[] = [];
    try {
      if (productId) {
        stages = await this.getProcessStagesByProduct(productId);
      } else if (!isDryRun) {
        const detail = await this.getActivityDetail(activityId);
        if (detail.productId) {
          stages = await this.getProcessStagesByProduct(detail.productId);
        }
      }
    } catch {
      // Ignorar fallo al obtener detalle
    }

    if (!stages || stages.length === 0) {
      return {
        dryRun: isDryRun,
        activityId,
        stagesAdvancedCount: 0,
        message: `Simulación/Ejecución: No se requirieron etapas adicionales de proceso o la actividad no tiene producto asignado.`,
      };
    }

    const results = [];
    for (const stage of stages) {
      const sId = stage.id || stage.stageId;
      if (sId) {
        const res = await this.advanceProcessStage(
          activityId,
          sId,
          assignedToId,
          notes || `Avance automático a etapa ${stage.name || sId}`,
          dryRun,
        );
        results.push({ stageId: sId, stageName: stage.name, result: res });
      }
    }

    return {
      dryRun: isDryRun,
      status: "SUCCESS",
      activityId,
      stagesAdvancedCount: results.length,
      stagesAdvanced: results,
      message: `Se avanzaron dinámicamente ${results.length} etapas para la actividad ${activityId}.`,
    };
  }

  /**
   * Consulta las observaciones/notas registradas en una actividad.
   */
  public async getObservations(activityId: number): Promise<any[]> {
    await authManager.getValidToken();
    try {
      const response = await apiClient.get(
        `/api/v1/activities/${activityId}/Observations`,
      );
      return response.data || [];
    } catch (error: any) {
      logger.error(
        `Error al consultar observaciones de actividad ${activityId}:`,
        error.message,
      );
      return [];
    }
  }

  /**
   * Agrega una observación o nota de cualquier tipo (General, Blocker, Agreement, Risk, etc.).
   * SEGURIDAD EN PRODUCCIÓN: Interceptado en modo dry-run.
   */
  public async addObservation(
    activityId: number,
    type: string,
    content: string,
    collaboratorId = env.DEFAULT_RESPONSIBLE_ID,
    dryRun = true,
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(
        `[DRY-RUN INTERCEPTOR] Simulación de adición de observación '${type}' para actividad ${activityId}.`,
      );
      return {
        dryRun: true,
        status: "SIMULATION_SUCCESS",
        targetEndpoint: `POST /api/v1/activities/${activityId}/Observations`,
        activityId,
        type,
        content,
        collaboratorId,
        message: `Simulación exitosa: Observación tipo '${type}' preparada. No se modificó la base de datos (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.info(
      `[PRODUCCIÓN REAL] Agregando observación tipo '${type}' a actividad ${activityId}...`,
    );
    const response = await apiClient.post(
      `/api/v1/activities/${activityId}/Observations`,
      {
        activityId,
        type,
        content,
        collaboratorId,
      },
    );
    return response.data;
  }

  /**
   * Elimina permanentemente una actividad por su ID numérico o clave.
   * OPERACIÓN CRÍTICA Y PELIGROSA: Interceptada estrictamente en modo dry-run por seguridad.
   */
  public async deleteActivity(
    idOrKey: number | string,
    dryRun = true,
  ): Promise<any> {
    const id = await this.resolveNumericActivityId(idOrKey);
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    if (isDryRun) {
      logger.warn(
        `[DRY-RUN INTERCEPTOR] Simulación de eliminación de actividad ${id}.`,
      );
      return {
        dryRun: true,
        status: "SIMULATION_SUCCESS",
        targetEndpoint: `DELETE /api/v1/Activities/${id}`,
        activityId: id,
        message: `Simulación de eliminación completada para actividad ${id}. No se realizaron cambios en producción (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    logger.warn(
      `[PRODUCCIÓN REAL] Ejecutando DELETE /api/v1/Activities/${id}...`,
    );
    const response = await apiClient.delete(`/api/v1/Activities/${id}`);
    return {
      deleted: true,
      activityId: id,
      targetEndpoint: `DELETE /api/v1/Activities/${id}`,
      data: response.data,
      message: `Actividad ${id} eliminada permanentemente de la base de datos productiva.`,
    };
  }
}

export const activityService = new ActivityService();
