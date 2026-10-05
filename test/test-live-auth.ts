import { authManager } from '../src/services/auth-manager.js';
import { sprintService } from '../src/services/sprint-service.js';
import { activityService } from '../src/services/activity-service.js';

async function main() {
  console.log('Probando autenticación con las credenciales de .env...');
  const token = await authManager.authenticate();
  if (token) {
    console.log('>>> ¡AUTENTICACIÓN EXITOSA! Token recibido.');
    const user = authManager.getCachedResponsible();
    console.log('Usuario:', user?.fullName, '| Capacidad:', user?.monthlyCapacity, 'hrs');

    console.log('\n--- Probando consulta real de Work Items del Sprint 1176 ---');
    try {
      const items = await sprintService.getSprintWorkItems(1176);
      console.log('Total de work items encontrados:', items.length);
      if (items.length > 0) {
        console.log('Primeros 3 items:');
        items.slice(0, 3).forEach((item, idx) => {
          console.log(`  ${idx + 1}. [ID: ${item.id}] ${item.title} (Asignado: ${item.assignedTo || 'Sin asignar'})`);
        });
      }
    } catch (e: any) {
      console.error('Error consultando sprint:', e.message);
    }

    console.log('\n--- Probando consulta real de actividades asignadas a Brayan ---');
    try {
      const acts = await activityService.getMyActivities(6, 'All');
      console.log('Total de actividades encontradas:', acts.length);
      if (acts.length > 0) {
        console.log('Primeras 3 actividades:');
        acts.slice(0, 3).forEach((act, idx) => {
          console.log(`  ${idx + 1}. [ID: ${act.id}] ${act.description} (Estado: ${act.status} | Avance: ${act.progressPercentage}%)`);
        });
      }
    } catch (e: any) {
      console.error('Error consultando actividades:', e.message);
    }
  } else {
    console.log('Falló la autenticación. Revisa el password en .env.');
  }
}

main().catch((err) => {
  console.error('Error en prueba live:', err);
});
