import { apiClient } from '../src/services/api-client.js';
import { authManager } from '../src/services/auth-manager.js';
import { SprintSyncResultDto, WorkItemSyncResultDto } from '../src/types/openapi.js';

async function main() {
  console.log('=== SINCRONIZANDO SPRINTS Y WORK ITEMS DE COMUNIDAD INFORMÁTICA ===');
  await authManager.getValidToken();

  const projectId = 11; // Comunidad Informática (CI)

  // 1. Sincronizar Sprints del Proyecto 11
  console.log(`\n1. Ejecutando POST /api/v1/Sprints/sync/${projectId} (Comunidad Informática)...`);
  try {
    const resSprints = await apiClient.post<SprintSyncResultDto>(`/api/v1/Sprints/sync/${projectId}`);
    console.log('>>> Resultado Sincronización Sprints:', JSON.stringify(resSprints.data, null, 2));
  } catch (e: any) {
    console.error('Error al sincronizar sprints del proyecto 11:', e.response?.data || e.message);
  }

  // 2. Sincronizar Work Items del Sprint 1176
  const sprintId = 1176;
  console.log(`\n2. Ejecutando POST /api/v1/Sprints/${sprintId}/work-items/sync...`);
  try {
    const resWorkItems = await apiClient.post<WorkItemSyncResultDto>(`/api/v1/Sprints/${sprintId}/work-items/sync`);
    console.log('>>> Resultado Sincronización Work Items:', JSON.stringify(resWorkItems.data, null, 2));
  } catch (e: any) {
    console.error(`Error al sincronizar work items del sprint ${sprintId}:`, e.response?.data || e.message);
  }
}

main().catch(console.error);
