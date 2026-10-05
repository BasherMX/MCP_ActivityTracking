import { apiClient } from '../src/services/api-client.js';
import { authManager } from '../src/services/auth-manager.js';

async function main() {
  await authManager.getValidToken();

  console.log('=== PROBANDO CONSULTA DINÁMICA DE CATÁLOGOS DESDE LA API ===\n');

  try {
    const resProjects = await apiClient.get('/api/v1/Projects/active');
    console.log(`1. Proyectos Activos (${resProjects.data?.length}):`);
    resProjects.data?.forEach((p: any) => console.log(`   - ID ${p.id}: ${p.name} (Prefijo: ${p.prefix})`));
  } catch (e: any) {
    console.error('Error Proyectos:', e.message);
  }

  try {
    const resServices = await apiClient.get('/api/v1/Services');
    console.log(`\n2. Servicios (${resServices.data?.length}):`);
    resServices.data?.forEach((s: any) => console.log(`   - ID ${s.id}: ${s.name}`));
  } catch (e: any) {
    console.error('Error Servicios:', e.message);
  }

  try {
    const resSprints = await apiClient.get('/api/v1/Sprints');
    console.log(`\n3. Sprints (${resSprints.data?.length}):`);
    if (resSprints.data?.length > 0) {
      console.log('Primeros 5 Sprints:');
      resSprints.data.slice(0, 5).forEach((sp: any) => {
        console.log(`   - ID ${sp.id}: ${sp.name || sp.sprintName} (ProyectoID: ${sp.projectId})`);
      });
    }
  } catch (e: any) {
    console.error('Error Sprints:', e.message);
  }

  try {
    const resTypes = await apiClient.get('/api/v1/catalogs/activity-types');
    console.log(`\n4. Tipos de Actividad (${resTypes.data?.length}):`);
    resTypes.data?.forEach((t: any) => console.log(`   - ID ${t.id}: ${t.name} / ${t.displayName}`));
  } catch (e: any) {
    console.error('Error Tipos:', e.message);
  }
}

main().catch(console.error);
