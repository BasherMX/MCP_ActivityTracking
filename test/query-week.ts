import { activityService } from '../src/services/activity-service.js';
import { timesheetService } from '../src/services/timesheet-service.js';
import { meetingService } from '../src/services/meeting-service.js';
import { formatISO, startOfWeek, endOfWeek } from 'date-fns';

async function main() {
  const now = new Date();
  const start = formatISO(startOfWeek(now, { weekStartsOn: 1 }));
  const end = formatISO(endOfWeek(now, { weekStartsOn: 1 }));

  console.log('=== CONSULTA DE ACTIVIDAD SEMANAL ===');
  console.log(`Rango: ${start} hasta ${end}\n`);

  // 1. Balance de horas
  try {
    const metrics = await timesheetService.getWorkBalanceMetrics(6, 'current_week');
    console.log(`Horas registradas en la semana: ${metrics.hoursWorkedInPeriod} hrs (Meta semanal: ${metrics.targetCapacity} hrs)`);
  } catch (e: any) {
    console.error('Error obteniendo métricas:', e.message);
  }

  // 2. Actividades asignadas
  const allActs = await activityService.getMyActivities(6, 'All');
  console.log(`\nTotal de actividades históricas de Brayan: ${allActs.length}`);

  // Filtrar actividades con fechas recientes o en progreso
  console.log('\n--- ACTIVIDADES EN PROGRESO Y RECIENTES ---');
  for (const act of allActs) {
    // Si está en progreso o con fechas recientes (2026-09 o 2026-10)
    const isRecent = 
      act.status === 'InProgress' ||
      (act.actualCompletionDate && act.actualCompletionDate.includes('2026-10')) ||
      (act.actualStartDate && act.actualStartDate.includes('2026-10')) ||
      (act.estimatedStartDate && act.estimatedStartDate.includes('2026-10'));

    if (isRecent) {
      console.log(`• [${act.activityId || act.id}] ${act.description}`);
      console.log(`  - Estado: ${act.status} | Avance: ${act.progressPercentage}%`);
      console.log(`  - Proyecto: ${act.projectName || 'N/A'} | Servicio: ${act.serviceName || 'N/A'}`);
      console.log(`  - Inicio real/est: ${act.actualStartDate || act.estimatedStartDate || 'N/A'}`);
      console.log(`  - Fin real/est: ${act.actualCompletionDate || act.estimatedDeliveryDate || 'N/A'}`);
      console.log('');
    }
  }

  // 3. Reuniones de la semana
  try {
    const meetings = await meetingService.getMeetings(start, end);
    console.log(`\n--- REUNIONES REGISTRADAS EN LA SEMANA (${meetings.length}) ---`);
    meetings.forEach((m) => {
      console.log(`• [${m.scheduledDate}] ${m.title} (${m.durationMinutes} min) - Estado: ${m.status}`);
    });
  } catch (e: any) {
    console.error('Error consultando reuniones:', e.message);
  }
}

main().catch(console.error);
