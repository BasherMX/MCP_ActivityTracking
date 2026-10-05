import { handleToolCall } from '../src/tools/index.js';
import { cleanEmailOrTicketText, formatStandardizedTitle } from '../src/utils/nlp-resolver.js';

async function test() {
  const prompt = `SALADO LOPEZ MA. DEL SOCORRO

GARCIA RICHARTE ADRIAN ALEJANDRO;
GALVAN CHAVEZ CRISTIAN;
RAMOS LANDEROS JACQUELINE;
De la manera más atenta, solicito su apoyo para dar de alta en el Calendario de Eventos Tecnológicos el evento programado para:

5 de octubre: Balanceo en los enlaces de Internet del Edificio Héroes - Ventana de Mantenimiento 20:00 hrs.
Agradezco de antemano su apoyo y quedo atento(a) a cualquier comentario o información adicional que se requiera.

Muchas Gracias.`;

  console.log('=== 1. Limpieza y análisis NLP ===');
  const cleaned = cleanEmailOrTicketText(prompt);
  console.log('Texto limpio:', cleaned);

  const title = formatStandardizedTitle(prompt, 'Redes e Infraestructura');
  console.log('Título Estandarizado generado:', title);

  console.log('\n=== 2. Invocación de track_create_activity (Dry-Run) con el prompt del usuario ===');
  const res = await handleToolCall('track_create_activity', {
    description: prompt,
    responsibleName: 'ADRIAN ALEJANDRO GARCIA RICHARTE',
    estimatedHours: 2.0,
    dryRun: true,
  });
  console.log(JSON.stringify(res, null, 2));

  console.log('\n=== 3. Comprobación del servidor activo en 10.185.1.67:3333 ===');
  const healthRes = await fetch('http://10.185.1.67:3333/health');
  const healthJson = await healthRes.json();
  console.log('Health check del servidor en 10.185.1.67:3333:', healthJson);
}

test().catch(console.error);
