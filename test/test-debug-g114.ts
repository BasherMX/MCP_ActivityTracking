import { activityService } from '../src/services/activity-service.js';
import { authManager } from '../src/services/auth-manager.js';

async function testG114() {
  console.log('Starting test...');
  await authManager.getValidToken();
  console.log('Authenticated as:', authManager.getResponsibleName());

  try {
    const id = await activityService.resolveNumericActivityId('G114');
    console.log('Resolved G114 to ID:', id);
  } catch (err: any) {
    console.error('Failed to resolve G114:', err.message);
  }

  try {
    const results = await activityService.searchActivities('G114');
    console.log('Search G114 found:', results.length, 'results:');
    results.forEach(r => console.log(`- ID: ${r.id}, Clave: ${r.activityId}, Resp: ${r.responsibleName}`));
  } catch (err: any) {
    console.error('Failed to search G114:', err.message);
  }
}

testG114().catch(console.error);

