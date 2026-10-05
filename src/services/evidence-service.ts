import fs from 'node:fs';
import path from 'node:path';
import mime from 'mime-types';
import FormData from 'form-data';
import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class EvidenceService {
  /**
   * Adjunta un archivo binario local como evidencia de una actividad.
   * SEGURIDAD EN PRODUCCIÓN: Si dryRun es true, valida existencia y tipo sin subir nada.
   */
  public async uploadEvidenceFile(
    activityId: number,
    filePath: string,
    description?: string,
    dryRun = true
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`El archivo local no existe en la ruta: ${resolvedPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    const fileName = path.basename(resolvedPath);
    const mimeType = mime.lookup(resolvedPath) || 'application/octet-stream';

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de subida de archivo para actividad ${activityId}.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `POST /api/v1/activities/${activityId}/evidence/file`,
        fileInfo: {
          path: resolvedPath,
          fileName,
          sizeBytes: stats.size,
          mimeType,
          description: description || 'Sin descripción',
        },
        message: 'Archivo verificado y validado localmente. No se subió a la base de datos (Modo Dry-Run).',
      };
    }

    await authManager.getValidToken();
    const form = new FormData();
    form.append('file', fs.createReadStream(resolvedPath), { filename: fileName, contentType: mimeType });
    if (description) {
      form.append('description', description);
    }

    const response = await apiClient.post(`/api/v1/activities/${activityId}/evidence/file`, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    return response.data;
  }

  /**
   * Adjunta un enlace URL como evidencia (GitLab MR, Issue, Documento).
   * SEGURIDAD EN PRODUCCIÓN: Si dryRun es true, valida URI sin llamar a la API.
   */
  public async attachEvidenceUrl(
    activityId: number,
    url: string,
    description?: string,
    dryRun = true
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;

    // Validación básica de URL
    new URL(url);

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de vinculación de URL para actividad ${activityId}.`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `POST /api/v1/activities/${activityId}/evidence/url`,
        activityId,
        url,
        description: description || 'Sin descripción',
        message: 'URL validada sintácticamente. No se insertó en la base productiva (Modo Dry-Run).',
      };
    }

    await authManager.getValidToken();
    const response = await apiClient.post(`/api/v1/activities/${activityId}/evidence/url`, {
      url,
      description,
    });
    return response.data;
  }
}

export const evidenceService = new EvidenceService();
