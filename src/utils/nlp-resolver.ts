import { ActivityType, FALLBACK_ACTIVITY_TYPES } from '../config/constants.js';
import { ProjectDto, ServiceDto, ResponsibleDto } from '../types/openapi.js';
import { env } from '../config/env.js';

export interface InferredActivityData {
  projectId: number;
  projectName: string;
  serviceId: number;
  serviceName: string;
  responsibleId?: number;
  responsibleName?: string;
  type: ActivityType;
  priority: 'Low' | 'Medium' | 'High';
  estimatedHours?: number;
}

/**
 * Resuelve dinámicamente el ID y nombre del responsable buscando coincidencias
 * de nombre o apellidos en la lista en tiempo real de la API.
 */
export function resolveResponsibleFromText(
  text: string,
  liveResponsibles: ResponsibleDto[],
  defaultResponsibleId = env.DEFAULT_RESPONSIBLE_ID
): { id: number; name: string } {
  if (!liveResponsibles || liveResponsibles.length === 0) {
    return { id: defaultResponsibleId, name: env.DEFAULT_RESPONSIBLE_NAME };
  }

  const lower = text.toLowerCase().trim();

  // 1. Coincidencia por nombre completo
  for (const resp of liveResponsibles) {
    if (resp.fullName) {
      const respLower = resp.fullName.toLowerCase();
      if (lower.includes(respLower) || respLower.includes(lower)) {
        return { id: resp.id, name: resp.fullName };
      }
    }
  }

  // 2. Coincidencia por palabras clave de nombre/apellidos (ej. "Adrian", "Garcia", "Richarte")
  for (const resp of liveResponsibles) {
    if (resp.fullName) {
      const respLower = resp.fullName.toLowerCase();
      const words = respLower.split(/\s+/).filter(w => w.length > 2);
      const matchedWords = words.filter(w => lower.includes(w));
      if (matchedWords.length >= 2) {
        return { id: resp.id, name: resp.fullName };
      }
    }
  }

  // 3. Coincidencia por username
  for (const resp of liveResponsibles) {
    if (resp.username) {
      const userLower = resp.username.toLowerCase();
      const userClean = userLower.replace('.', ' ');
      if (lower.includes(userLower) || lower.includes(userClean)) {
        return { id: resp.id, name: resp.fullName || resp.username };
      }
    }
  }

  // Fallback al responsable predeterminado
  const defaultResp = liveResponsibles.find(r => r.id === defaultResponsibleId) || liveResponsibles[0];
  return { id: defaultResp.id, name: defaultResp.fullName || env.DEFAULT_RESPONSIBLE_NAME };
}

/**
 * Resuelve dinámicamente el ID y nombre del proyecto buscando coincidencias
 * en la lista activa recibida en tiempo real desde la API.
 */
export function resolveProjectFromText(
  text: string,
  liveProjects: ProjectDto[],
  defaultProjectId = env.DEFAULT_PROJECT_ID
): { id: number; name: string } {
  if (!liveProjects || liveProjects.length === 0) {
    return { id: defaultProjectId, name: 'Proyecto Predeterminado' };
  }

  const lower = text.toLowerCase().trim();

  // 1. Buscar coincidencia exacta por prefijo (ej. CI, PTO, SIM, SD, HUB, SIGI)
  for (const proj of liveProjects) {
    if (proj.prefix) {
      const prefixRegex = new RegExp(`\\b${proj.prefix.toLowerCase()}\\b`, 'i');
      if (prefixRegex.test(lower)) {
        return { id: proj.id, name: proj.name || proj.prefix };
      }
    }
  }

  // 2. Buscar coincidencia por nombre de proyecto o palabras clave principales
  for (const proj of liveProjects) {
    if (proj.name) {
      const projLower = proj.name.toLowerCase();
      // Si la frase del usuario contiene el nombre del proyecto o viceversa
      if (lower.includes(projLower) || projLower.includes(lower)) {
        return { id: proj.id, name: proj.name };
      }

      // Palabras significativas del proyecto (ignorando conectores comunes)
      const words = projLower.split(/\s+/).filter((w) => w.length > 3 && !['para', 'sobre', 'este', 'esta', 'sistema', 'apoyo', 'servicio', 'desarrollo', 'plataforma'].includes(w));
      for (const word of words) {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
        if (wordRegex.test(lower)) {
          return { id: proj.id, name: proj.name };
        }
      }
    }
  }

  // 3. Fallback al proyecto predeterminado o al primero de la lista dinámica
  const defaultProj = liveProjects.find((p) => p.id === defaultProjectId) || liveProjects[0];
  return { id: defaultProj.id, name: defaultProj.name || 'Proyecto Predeterminado' };
}

/**
 * Resuelve dinámicamente el ID y nombre del servicio buscando coincidencias
 * en la lista en tiempo real devuelta por la API.
 */
export function resolveServiceFromText(
  text: string,
  liveServices: ServiceDto[],
  defaultServiceId = env.DEFAULT_SERVICE_ID
): { id: number; name: string } {
  if (!liveServices || liveServices.length === 0) {
    return { id: defaultServiceId, name: 'Servicio Predeterminado' };
  }

  const lower = text.toLowerCase().trim();

  // Reglas heurísticas de contexto asociadas a tipos de servicios
  if (/(base.*datos|sql|etl|pipeline|analítica|data|datos)/i.test(lower)) {
    const dataService = liveServices.find((s) => s.name?.toLowerCase().includes('datos') || s.name?.toLowerCase().includes('data'));
    if (dataService) return { id: dataService.id, name: dataService.name || '' };
  }

  if (/(cooperación|convenio|vinculación|externa)/i.test(lower)) {
    const coopService = liveServices.find((s) => s.name?.toLowerCase().includes('cooperación'));
    if (coopService) return { id: coopService.id, name: coopService.name || '' };
  }

  if (/(transversal|reunión general|inducción|capacitación)/i.test(lower)) {
    const transService = liveServices.find((s) => s.name?.toLowerCase().includes('transversal'));
    if (transService) return { id: transService.id, name: transService.name || '' };
  }

  if (/(arquitectura|normativa|innovación)/i.test(lower)) {
    const arqService = liveServices.find((s) => s.name?.toLowerCase().includes('arquitectura') || s.name?.toLowerCase().includes('innovación'));
    if (arqService) return { id: arqService.id, name: arqService.name || '' };
  }

  // Buscar por coincidencia directa de nombre
  for (const serv of liveServices) {
    if (serv.name) {
      const servLower = serv.name.toLowerCase();
      if (lower.includes(servLower)) {
        return { id: serv.id, name: serv.name };
      }
    }
  }

  // Fallback al servicio predeterminado o al primero de la lista dinámica
  const defaultServ = liveServices.find((s) => s.id === defaultServiceId) || liveServices[0];
  return { id: defaultServ.id, name: defaultServ.name || 'Servicio Predeterminado' };
}

export function resolveTypeFromText(text: string, defaultType: ActivityType = 'Development'): ActivityType {
  const lower = text.toLowerCase();

  if (/(correg|error|bug|parche|fix|hotfix|repar|mantenimiento)/i.test(lower)) {
    return 'Maintenance';
  }
  if (/(planning|planific|estimaci|roadmap|alcance|reuni.*plan)/i.test(lower)) {
    return 'Planning';
  }
  if (/(soporte|atend|ticket|mesa.*ayuda|duda.*usuari)/i.test(lower)) {
    return 'Support';
  }
  if (/(operaci|despliegue|deploy|liberaci|monitoreo)/i.test(lower)) {
    return 'Operational';
  }
  if (/(diseño|ux|ui|mockup|wireframe|pantallas|figma)/i.test(lower)) {
    return 'Desing';
  }
  if (/(análisis|analiz|investig|spike|revisi.*requerimiento)/i.test(lower)) {
    return 'Analysis';
  }
  if (/(review|revisi.*código|code.*review|pr|pull.*request|merge.*request)/i.test(lower)) {
    return 'Review';
  }
  if (/(curso|capacitaci|taller|entrenam|training|diplomado)/i.test(lower)) {
    return 'Training';
  }
  if (/(desarroll|program|constru|implement|maquet|codif|feature)/i.test(lower)) {
    return 'Development';
  }

  return defaultType;
}

export function extractHoursFromText(text: string): number | undefined {
  const hoursRegex = /(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|h)\b/i;
  const matchHours = text.match(hoursRegex);
  if (matchHours) {
    return parseFloat(matchHours[1]);
  }

  const minsRegex = /(\d+)\s*(?:minutos?|mins?|m)\b/i;
  const matchMins = text.match(minsRegex);
  if (matchMins) {
    return Math.round((parseInt(matchMins[1], 10) / 60) * 100) / 100;
  }

  return undefined;
}

export function cleanEmailOrTicketText(rawText: string): string {
  let text = rawText.trim();

  if (text.length < 200 && !/De:|Enviado:|Para:|Asunto:|Saludos/i.test(text)) {
    return text;
  }

  text = text.replace(/(?:De|Enviado|Para|Cc|Asunto):\s*[^\r\n]+/gi, ' ');
  text = text.replace(/(?:Saludos\s*cordiales|Quedo\s*atento|Buen\s*día[^\n.]*|Atentamente)[^\n]*/gi, ' ');
  text = text.replace(/(?:ENLACE DE SERVICIOS|COORDINACIÓN GENERAL|Tel:\s*\d+|Ext:\s*\d+)/gi, ' ');
  text = text.replace(/\[mailto:[^\]]+\]/gi, ' ');
  text = text.replace(/<[^>]+@in-egi\.org\.mx>/gi, ' ');

  const fileMatch = text.match(/(?:se (?:sustituyó|actualizó|creó|modificó|subió)|solicito|favor de)\s+[^.\n]+/i);
  if (fileMatch) {
    return fileMatch[0].trim();
  }

  const pathMatch = text.match(/archivo\s+[^.\n]+/i);
  if (pathMatch) {
    return pathMatch[0].trim();
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 200) {
    text = text.substring(0, 197) + '...';
  }
  return text;
}

export function inferActivityMetadata(
  text: string,
  liveProjects: ProjectDto[] = [],
  liveServices: ServiceDto[] = [],
  liveResponsibles: ResponsibleDto[] = []
): InferredActivityData {
  const cleanedText = cleanEmailOrTicketText(text);
  const project = resolveProjectFromText(text, liveProjects);
  const service = resolveServiceFromText(text, liveServices);
  const responsible = resolveResponsibleFromText(text, liveResponsibles);
  const type = resolveTypeFromText(cleanedText);
  const hours = extractHoursFromText(text);

  let priority: 'Low' | 'Medium' | 'High' = 'Medium';
  if (/(urgente|crític|alta prioridad|inmediato|asap)/i.test(text)) {
    priority = 'High';
  } else if (/(baja prioridad|menor|opcional|cuando se pueda)/i.test(text)) {
    priority = 'Low';
  }

  return {
    projectId: project.id,
    projectName: project.name,
    serviceId: service.id,
    serviceName: service.name,
    responsibleId: responsible.id,
    responsibleName: responsible.name,
    type,
    priority,
    estimatedHours: hours,
  };
}

export const ALLOWED_INFINITIVE_VERBS = [
  'Actualizar',
  'Analizar',
  'Atender',
  'Configurar',
  'Corregir',
  'Dar seguimiento',
  'Desarrollar',
  'Diagnosticar',
  'Documentar',
  'Generar',
  'Implementar',
  'Integrar',
  'Investigar',
  'Migrar',
  'Optimizar',
  'Planear',
  'Proponer',
  'Rediseñar',
  'Registrar',
  'Revisar',
  'Solicitar',
  'Validar',
  'Verificar',
] as const;

/**
 * Formatea un título estandarizado directo para tickets/actividades TIC
 * Estructura: [Verbo en infinitivo] + [objeto específico] + para + [propósito o resultado]
 * Sin redundancias de nombre de proyecto, máx ~120 caracteres y tono técnico institucional.
 */
export function formatStandardizedTitle(rawDescription: string, projectName?: string): string {
  let clean = rawDescription.trim().replace(/^["']|["']$/g, '');

  // 1. Eliminar redundancia del nombre del proyecto (Regla 05)
  if (projectName) {
    const projRegex = new RegExp(`\\b${projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    clean = clean.replace(projRegex, '').trim();
  }

  // 2. Determinar verbo en infinitivo (Regla 01)
  let verb = 'Desarrollar';
  const lower = clean.toLowerCase();

  if (/(correg|error|bug|fix|hotfix|repar)/i.test(lower)) verb = 'Corregir';
  else if (/(análisis|analiz|investig|evalu)/i.test(lower)) verb = 'Analizar';
  else if (/(document|md|markdown|guía|manual)/i.test(lower)) verb = 'Documentar';
  else if (/(configur|setup|ajust)/i.test(lower)) verb = 'Configurar';
  else if (/(optimiz|mejorar|rendimiento|velocidad)/i.test(lower)) verb = 'Optimizar';
  else if (/(revis|review|auditor)/i.test(lower)) verb = 'Revisar';
  else if (/(plan|roadmap|sprint|estimar)/i.test(lower)) verb = 'Planear';
  else if (/(integr|mcp|api|endpoint|webhook)/i.test(lower)) verb = 'Integrar';
  else if (/(valid|probar|test|verificar)/i.test(lower)) verb = 'Validar';

  // Remover palabras o sustantivos informales iniciales
  clean = clean.replace(/^(hacer|realizar|checar|ver la opción de|arreglar|poner|crear|generación de|análisis de|documentación de|solicitud de)\s+/i, '');

  // 3. Garantizar que inicie con verbo en infinitivo si ya tiene uno
  const firstWord = clean.split(/\s+/)[0];
  if (firstWord && ALLOWED_INFINITIVE_VERBS.some(v => v.toLowerCase() === firstWord.toLowerCase())) {
    const matched = ALLOWED_INFINITIVE_VERBS.find(v => v.toLowerCase() === firstWord.toLowerCase());
    if (matched) verb = matched;
    clean = clean.substring(firstWord.length).trim();
  }

  // 4. Asegurar presencia de "para" (Regla 03)
  let title = '';
  if (/\bpara\b/i.test(clean)) {
    title = `${verb} ${clean}`;
  } else {
    title = `${verb} ${clean} para optimizar el flujo operativo institucional`;
  }

  // 5. Truncar a ~120 caracteres si sobrepasa (Regla 04)
  if (title.length > 120) {
    title = title.substring(0, 117) + '...';
  }

  return title;
}

/**
 * Genera opciones de títulos estandarizados para tickets/actividades TIC.
 */
export function generateStandardizedTitles(rawDescription: string): string[] {
  let clean = rawDescription.trim().replace(/^["']|["']$/g, '');

  let verb = 'Desarrollar';
  const lower = clean.toLowerCase();

  if (/(correg|error|bug|fix|hotfix|repar)/i.test(lower)) verb = 'Corregir';
  else if (/(análisis|analiz|investig|evalu)/i.test(lower)) verb = 'Analizar';
  else if (/(document|md|markdown|guía|manual)/i.test(lower)) verb = 'Documentar';
  else if (/(configur|setup|ajust)/i.test(lower)) verb = 'Configurar';
  else if (/(optimiz|mejorar|rendimiento|velocidad)/i.test(lower)) verb = 'Optimizar';
  else if (/(revis|review|auditor)/i.test(lower)) verb = 'Revisar';
  else if (/(plan|roadmap|sprint|estimar)/i.test(lower)) verb = 'Planear';
  else if (/(integr|mcp|api|endpoint|webhook)/i.test(lower)) verb = 'Integrar';
  else if (/(valid|probar|test|verificar)/i.test(lower)) verb = 'Validar';

  clean = clean.replace(/^(hacer|realizar|checar|ver la opción de|arreglar|poner|crear|generación de|análisis de|documentación de|solicitud de)\s+/i, '');

  const opt1 = `${verb} ${clean} para asegurar el cumplimiento del requerimiento técnico`;
  const opt2 = `${verb} módulo de ${clean} para optimizar el flujo operativo institucional`;
  const opt3 = `${verb} componente de ${clean} para garantizar la calidad del sistema`;

  return [
    opt1.length > 120 ? opt1.substring(0, 117) + '...' : opt1,
    opt2.length > 120 ? opt2.substring(0, 117) + '...' : opt2,
    opt3.length > 120 ? opt3.substring(0, 117) + '...' : opt3,
  ];
}


