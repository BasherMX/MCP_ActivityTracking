import { catalogService } from '../src/services/catalog-service.js';

async function findAdrian() {
  const responsibles = await catalogService.getResponsibles();
  console.log('Total responsables:', responsibles.length);
  const adrian = responsibles.find(
    (r) =>
      r.fullName?.toLowerCase().includes('adrian') ||
      r.username?.toLowerCase().includes('adrian')
  );
  console.log('Adrián encontrado:', JSON.stringify(adrian, null, 2));

  const projects = await catalogService.getProjects();
  console.log('Total proyectos:', projects.length);
  const relevantProjects = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes('comunidad') ||
      p.name?.toLowerCase().includes('infraestructura') ||
      p.name?.toLowerCase().includes('redes') ||
      p.name?.toLowerCase().includes('soporte') ||
      p.name?.toLowerCase().includes('operación') ||
      p.name?.toLowerCase().includes('mantenimiento')
  );
  console.log('Proyectos relevantes:', JSON.stringify(relevantProjects, null, 2));
}

findAdrian().catch(console.error);
