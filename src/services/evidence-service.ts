import fs from 'node:fs';
import path from 'node:path';
import mime from 'mime-types';
import FormData from 'form-data';
import { apiClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { activityService } from './activity-service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface UploadEvidenceOptions {
  filePath?: string;
  fileName?: string;
  content?: string;
  fileContent?: string;
  fileContentBase64?: string;
  description?: string;
  mimeType?: string;
}

export class EvidenceService {
  /**
   * Adjunta un archivo de evidencia a una actividad (soporta archivo local, texto directo o Base64).
   * Funciona transparentemente en entornos locales y contenedores Podman/Docker sin filesystem compartido.
   * SEGURIDAD EN PRODUCCIÓN: Si dryRun es true, valida existencia y tipo sin subir nada.
   */
  public async uploadEvidenceFile(
    activityIdentifier: number | string,
    options: UploadEvidenceOptions | string,
    description?: string,
    dryRun = true
  ): Promise<any> {
    const targetOptions: UploadEvidenceOptions =
      typeof options === 'string'
        ? { filePath: options, description }
        : options;

    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;
    const activityId = await activityService.resolveNumericActivityId(activityIdentifier);

    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;

    if (targetOptions.fileContentBase64) {
      fileBuffer = Buffer.from(targetOptions.fileContentBase64, 'base64');
      fileName = targetOptions.fileName || (targetOptions.filePath ? path.basename(targetOptions.filePath) : 'evidencia.bin');
      mimeType = targetOptions.mimeType || (mime.lookup(fileName) as string) || 'application/octet-stream';
    } else if (targetOptions.content !== undefined || targetOptions.fileContent !== undefined) {
      const textContent = targetOptions.content !== undefined ? targetOptions.content : targetOptions.fileContent!;
      fileBuffer = Buffer.from(textContent, 'utf-8');
      fileName = targetOptions.fileName || (targetOptions.filePath ? path.basename(targetOptions.filePath) : 'evidencia.md');
      mimeType = targetOptions.mimeType || (mime.lookup(fileName) as string) || 'text/markdown';
    } else if (targetOptions.filePath) {
      const resolvedPath = path.resolve(targetOptions.filePath);
      if (fs.existsSync(resolvedPath)) {
        fileBuffer = fs.readFileSync(resolvedPath);
        fileName = targetOptions.fileName || path.basename(resolvedPath);
        mimeType = targetOptions.mimeType || (mime.lookup(resolvedPath) as string) || 'application/octet-stream';
      } else {
        throw new Error(
          `El archivo '${targetOptions.filePath}' no existe en el entorno del servidor MCP. ` +
          `Si el servidor está en un contenedor Podman/Docker, proporcione el contenido directamente en el argumento 'content' o 'fileContent' (texto) o 'fileContentBase64' (base64) junto con 'fileName' (ej. '${path.basename(targetOptions.filePath)}').`
        );
      }
    } else {
      throw new Error(
        "Debe proporcionar 'content'/'fileContent' (texto directo), 'fileContentBase64' (base64) o 'filePath' (ruta local accesible)."
      );
    }

    const desc = targetOptions.description || description;

    if (isDryRun) {
      logger.warn(`[DRY-RUN INTERCEPTOR] Simulación de subida de evidencia para actividad ${activityId} (${fileName}).`);
      return {
        dryRun: true,
        status: 'SIMULATION_SUCCESS',
        targetEndpoint: `POST /api/v1/activities/${activityId}/evidence/file`,
        activityId,
        fileInfo: {
          fileName,
          sizeBytes: fileBuffer.length,
          mimeType,
          description: desc || 'Sin descripción',
        },
        message: `Archivo '${fileName}' (${fileBuffer.length} bytes) validado exitosamente. No se subió a producción (Modo Dry-Run).`,
      };
    }

    await authManager.getValidToken();
    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });
    if (desc) {
      form.append('description', desc);
    }

    logger.info(`[PRODUCCIÓN REAL] Subiendo evidencia '${fileName}' (${fileBuffer.length} bytes) a actividad ${activityId}...`);
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
    activityIdentifier: number | string,
    url: string,
    description?: string,
    dryRun = true
  ): Promise<any> {
    const isDryRun = dryRun !== undefined ? dryRun : env.DRY_RUN_MODE;
    const activityId = await activityService.resolveNumericActivityId(activityIdentifier);

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

