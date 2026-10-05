import { getToolDefinitions, handleToolCall } from '../src/tools/index.js';
import { cleanEmailOrTicketText, formatStandardizedTitle } from '../src/utils/nlp-resolver.js';

async function testAdrianFlow() {
  console.log('=== TEST FLOW: Registrar actividad para Adrián García Richarte ===\n');

  const rawPrompt = `GARCIA RICHARTE ADRIAN ALEJANDRO
SALADO LOPEZ MA. DEL SOCORRO;
GALVAN CHAVEZ CRISTIAN;
RAMOS LANDEROS JACQUELINE;
Buen día, Mary Coco.
Te informo que la actualización solicitada ya fue realizada en la Comunidad Informática. Se sustituyó el archivo Formato Solicitud de Registro de Grupo de Operación de TIC.docx en la ruta indicada:
Gobierno, Arquitectura y Seguridad → Gobernanza y Coordinación → Grupo de Coordinación de TIC → Formatos del Documento de Plan Inicial → Formatos para Registro de Iniciativa → Formato Solicitud de Registro de Grupo de Operación de TIC.docx
Agradeceré, de ser posible, validar que la actualización se visualice correctamente.
Quedo atento a cualquier comentario o requerimiento adicional.
Saludos cordiales.
ADRIAN ALEJANDRO GARCIA RICHARTE
ENLACE DE SERVICIOS
COORDINACIÓN GENERAL DE INFORMÁTICA
Tel:4499105300, Ext:4204, Tel:4499105300, Ext:4007`;

  console.log('1. Probando limpieza de texto de correo/ticket:');
  const cleaned = cleanEmailOrTicketText(rawPrompt);
  console.log('Texto limpio extraído:', cleaned);

  const title = formatStandardizedTitle(rawPrompt, 'Comunidad Informática');
  console.log('Título Estandarizado generado:', title);

  console.log('\n2. Ejecutando track_create_activity con resolución automática por nombre, estado Completed y autoAdvanceStages (Dry-Run)...');

  const result = await handleToolCall('track_create_activity', {
    description: rawPrompt,
    responsibleName: 'Adrian garcia richarte',
    projectName: 'Comunidad Informática',
    status: 'Completed',
    autoAdvanceStages: true,
    dryRun: true,
  });

  console.log('\nResultado final del handler MCP:');
  console.log(JSON.stringify(result, null, 2));
}

testAdrianFlow().catch(console.error);
