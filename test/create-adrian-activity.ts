import { handleToolCall } from '../src/tools/index.js';

async function createAdrianActivity() {
  const prompt = `SALADO LOPEZ MA. DEL SOCORRO

GARCIA RICHARTE ADRIAN ALEJANDRO;
GALVAN CHAVEZ CRISTIAN;
RAMOS LANDEROS JACQUELINE;
De la manera más atenta, solicito su apoyo para dar de alta en el Calendario de Eventos Tecnológicos el evento programado para:

5 de octubre: Balanceo en los enlaces de Internet del Edificio Héroes - Ventana de Mantenimiento 20:00 hrs.
Agradezco de antemano su apoyo y quedo atento(a) a cualquier comentario o información adicional que se requiera.

Muchas Gracias.`;

  console.log('=== Creando Actividad Real en Producción para Adrián García ===');

  const result = await handleToolCall('track_create_activity', {
    description: prompt,
    responsibleName: 'GARCIA RICHARTE ADRIAN ALEJANDRO',
    projectName: 'Comunidad Informática',
    serviceId: 4,
    productId: 17, // Operación y mantenimiento de sistemas o componentes implementados en infraestructura institucional
    type: 'Maintenance',
    priority: 'Medium',
    status: 'InProgress',
    estimatedHours: 2.0,
    dryRun: false,
    notes: 'Solicitud de alta en Calendario de Eventos Tecnológicos para balanceo en enlaces de Internet Edificio Héroes.',
  });

  console.log('Resultado de creación en API:');
  console.log(JSON.stringify(result, null, 2));
}

createAdrianActivity().catch((err) => {
  console.error('Error al registrar actividad:', err?.response?.data || err?.message || err);
});
