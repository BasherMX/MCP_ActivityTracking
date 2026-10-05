import { handleToolCall, getToolDefinitions } from '../src/tools/index.js';

async function runDryRunTests() {
  console.log('=== TEST 1: Verificar Definición de Herramientas ===');
  const tools = getToolDefinitions();
  console.log(`Total de herramientas registradas: ${tools.length}`);
  tools.forEach((t, i) => console.log(`  ${i + 1}. [${t.name}] - ${t.description.substring(0, 70)}...`));

  console.log('\n=== TEST 2: track_create_activity (Inferencia Natural + Dry-Run) ===');
  const resCreate = await handleToolCall('track_create_activity', {
    description: 'Implementación de vista de autenticación y corrección de bug en Comunidad Informática',
    estimatedHours: 3.5,
    dryRun: true,
  });
  console.log('Resultado Create (Dry-Run):', JSON.stringify(resCreate, null, 2));

  console.log('\n=== TEST 3: track_update_activity (Dry-Run) ===');
  const resUpdate = await handleToolCall('track_update_activity', {
    id: 105,
    status: 'InProgress',
    progressPercentage: 75,
    notes: 'Avance al 75% tras pruebas unitarias',
    dryRun: true,
  });
  console.log('Resultado Update (Dry-Run):', JSON.stringify(resUpdate, null, 2));

  console.log('\n=== TEST 4: track_close_activity (Dry-Run) ===');
  const resClose = await handleToolCall('track_close_activity', {
    id: 105,
    actualHours: 4.0,
    completionNotes: 'Tarea completada satisfactoriamente y testeada.',
    dryRun: true,
  });
  console.log('Resultado Close (Dry-Run):', JSON.stringify(resClose, null, 2));

  console.log('\n=== TEST 5: track_log_work_hours (Dry-Run) ===');
  const resLog = await handleToolCall('track_log_work_hours', {
    activityId: 105,
    hoursWorked: 2.5,
    notes: 'Commits de desarrollo y resolución de conflictos',
    dryRun: true,
  });
  console.log('Resultado Log Hours (Dry-Run):', JSON.stringify(resLog, null, 2));

  console.log('\n=== TEST 6: track_attach_evidence_url (Dry-Run) ===');
  const resUrl = await handleToolCall('track_attach_evidence_url', {
    activityId: 105,
    url: 'https://gitlab.internal/proyectos/ci/merge_requests/42',
    description: 'Merge request aprobado',
    dryRun: true,
  });
  console.log('Resultado URL Evidence (Dry-Run):', JSON.stringify(resUrl, null, 2));

  console.log('\n=== TEST 7: track_get_catalogs (Lectura de Catálogos) ===');
  const resCat = await handleToolCall('track_get_catalogs', { catalog: 'all' });
  console.log('Catálogos Proyectos:', resCat.projects.map((p: any) => `${p.id}: ${p.name} (${p.prefix})`));
  console.log('Catálogos Servicios:', resCat.services.map((s: any) => `${s.id}: ${s.name}`));

  console.log('\n>>> TODOS LOS TESTS DE DRY-RUN Y ESQUEMAS COMPLETADOS CON ÉXITO <<<');
}

runDryRunTests().catch((err) => {
  console.error('Fallo en test de dry-run:', err);
  process.exit(1);
});
