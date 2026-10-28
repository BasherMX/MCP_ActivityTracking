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
    notes: 'Avance tras pruebas unitarias y actualización de notas',
    dryRun: true,
  });
  console.log('Resultado Update (Dry-Run):', JSON.stringify(resUpdate, null, 2));

  console.log('\n=== TEST 4: track_close_activity (Dry-Run via Stage Complete) ===');
  const resClose = await handleToolCall('track_close_activity', {
    id: 105,
    notes: 'Tarea completada satisfactoriamente y testeada.',
    dryRun: true,
  });
  console.log('Resultado Close (Dry-Run):', JSON.stringify(resClose, null, 2));

  console.log('\n=== TEST 4.1: track_cancel_activity (Dry-Run via Stage Cancel) ===');
  const resCancel = await handleToolCall('track_cancel_activity', {
    id: 105,
    reason: 'Cambio de alcance decidido en reunión de refinamiento',
    dryRun: true,
  });
  console.log('Resultado Cancel (Dry-Run):', JSON.stringify(resCancel, null, 2));

  console.log('\n=== TEST 4.2: track_reopen_activity (Dry-Run via Stage Reopen) ===');
  const resReopen = await handleToolCall('track_reopen_activity', {
    id: 105,
    dryRun: true,
  });
  console.log('Resultado Reopen (Dry-Run):', JSON.stringify(resReopen, null, 2));

  console.log('\n=== TEST 4.3: track_get_current_process_stage (Lectura de Etapa Activa) ===');
  const resCurrentStage = await handleToolCall('track_get_current_process_stage', {
    activityId: 105,
  });
  console.log('Resultado Current Process Stage:', JSON.stringify(resCurrentStage, null, 2));

  console.log('\n=== TEST 5: track_log_work_hours con progressDelta (Dry-Run) ===');
  const resLog = await handleToolCall('track_log_work_hours', {
    activityId: 105,
    hoursWorked: 2.5,
    progressDelta: 20,
    notes: 'Commits de desarrollo y resolución de conflictos (+20% avance)',
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

  console.log('\n=== TEST 7: track_add_observation (con Resolución y createdBy dinámico) ===');
  const resObs = await handleToolCall('track_add_observation', {
    activityId: 105,
    type: 'Resolución',
    content: 'Se resolvió el bloqueo en pipeline de CI/CD tras actualizar variables de entorno',
    dryRun: true,
  });
  console.log('Resultado Add Observation (Dry-Run):', JSON.stringify(resObs, null, 2));

  console.log('\n=== TEST 8: track_add_stage_collaborator (Colaborador en Etapa) ===');
  const resCollab = await handleToolCall('track_add_stage_collaborator', {
    progressId: 2512,
    responsibleId: 31,
    dryRun: true,
  });
  console.log('Resultado Add Stage Collaborator (Dry-Run):', JSON.stringify(resCollab, null, 2));

  console.log('\n=== TEST 9: track_report_app_issue (Reporte de Falla Técnica) ===');
  const resIssue = await handleToolCall('track_report_app_issue', {
    title: 'Error de visualización en panel de métricas',
    description: 'La gráfica de balance tarda más de 30 segundos en renderizar para usuarios con alto volumen de registros',
    severity: 'Medium',
    type: 'Issue',
    pageUrl: '/dashboard/metrics',
    dryRun: true,
  });
  console.log('Resultado Report App Issue (Dry-Run):', JSON.stringify(resIssue, null, 2));

  console.log('\n=== TEST 9.1: track_submit_idea (Propuesta de Mejora con Captura Base64) ===');
  const resIdea = await handleToolCall('track_submit_idea', {
    title: 'Exportación masiva de reportes a formato XLSX y PDF',
    description: 'Agregar botón para descargar en un click el reporte mensual consolidado en formato Excel con gráficas incluidas.',
    screenshotBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    fileName: 'mockup_exportacion.png',
    pageUrl: '/reports/monthly',
    dryRun: true,
  });
  console.log('Resultado Submit Idea (Dry-Run):', JSON.stringify(resIdea, null, 2));

  console.log('\n=== TEST 9.2: track_get_app_issues con filtro de Tipo "Idea" ===');
  const resGetIdeas = await handleToolCall('track_get_app_issues', {
    type: 'Idea',
  });
  console.log(`Resultado Get App Ideas (Total recuperadas: ${Array.isArray(resGetIdeas) ? resGetIdeas.length : 0})`);

  console.log('\n=== TEST 10: track_update_app_issue_status (Resolución de Issue) ===');
  const resIssueUpdate = await handleToolCall('track_update_app_issue_status', {
    id: 12,
    status: 'Resolved',
    resolutionNotes: 'Se optimizó la consulta indexando la columna responsibleId en BD',
    dryRun: true,
  });
  console.log('Resultado Update App Issue (Dry-Run):', JSON.stringify(resIssueUpdate, null, 2));

  console.log('\n=== TEST 11: track_get_catalogs (Lectura de Catálogos) ===');
  const resCat = await handleToolCall('track_get_catalogs', { catalog: 'all' });
  console.log('Catálogos Proyectos:', resCat.projects?.map((p: any) => `${p.id}: ${p.name} (${p.prefix})`));
  console.log('Catálogos Servicios:', resCat.services?.map((s: any) => `${s.id}: ${s.name}`));

  console.log('\n>>> TODOS LOS TESTS DE DRY-RUN Y ESQUEMAS COMPLETADOS CON ÉXITO <<<');
}

runDryRunTests().catch((err) => {
  console.error('Fallo en test de dry-run:', err);
  process.exit(1);
});
