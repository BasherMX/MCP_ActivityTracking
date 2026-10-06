import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { sprintService } from "../services/sprint-service.js";
import { activityService } from "../services/activity-service.js";
import { timesheetService } from "../services/timesheet-service.js";
import { meetingService } from "../services/meeting-service.js";
import { catalogService } from "../services/catalog-service.js";
import { evidenceService } from "../services/evidence-service.js";
import { incidenceService } from "../services/incidence-service.js";
import { authManager } from "../services/auth-manager.js";
import { inferActivityMetadata, formatStandardizedTitle, resolveResponsibleFromText, cleanEmailOrTicketText } from "../utils/nlp-resolver.js";
import { env } from "../config/env.js";


// ============================================================================
// ESQUEMAS ZOD DINÁMICOS Y REACTIVOS
// ============================================================================

export const GetSprintWorkItemsSchema = z.object({
  sprintId: z
    .number()
    .int()
    .optional()
    .describe(
      "ID numérico del Sprint a consultar. Si se omite, se resuelve DINÁMICAMENTE el último sprint activo del proyecto.",
    ),
  projectId: z
    .number()
    .int()
    .optional()
    .describe(
      "ID opcional del proyecto. Si se omite, se utiliza el proyecto predeterminado o la resolución dinámica.",
    ),
  projectName: z
    .string()
    .optional()
    .describe(
      'Nombre o prefijo del proyecto para resolver el sprint dinámicamente (ej. "Comunidad Informática", "CI", "PTO", "SIM").',
    ),
  assignedTo: z
    .string()
    .optional()
    .describe('Filtro opcional por nombre o usuario asignado (ej. "brayan").'),
});

export const SyncSprintsSchema = z.object({
  projectId: z
    .number()
    .int()
    .optional()
    .describe(
      "ID numérico del proyecto a sincronizar con Azure DevOps. Si se omite, se resuelve por nombre o usa el predeterminado.",
    ),
  projectName: z
    .string()
    .optional()
    .describe(
      'Nombre o prefijo del proyecto a sincronizar (ej. "Comunidad Informática", "CI", "PTO").',
    ),
  sprintId: z
    .number()
    .int()
    .optional()
    .describe(
      "ID opcional del sprint específico a sincronizar. Si se omite, sincroniza dinámicamente el último sprint activo.",
    ),
});

export const GetMyActivitiesSchema = z.object({
  responsibleId: z
    .number()
    .int()
    .optional()
    .describe("ID numérico del responsable (omita para usar el usuario autenticado por defecto)."),
  responsibleName: z
    .string()
    .optional()
    .describe("Nombre o apellido del responsable (ej. 'Adrian', 'Mariana', 'Brayan') para resolver su ID dinámicamente."),
  status: z
    .string()
    .default("InProgress")
    .describe(
      "Filtro de estado de la actividad (InProgress, Pending, Completed, All).",
    ),
  projectId: z
    .number()
    .int()
    .optional()
    .describe("Filtro opcional por ID de proyecto."),
  projectName: z
    .string()
    .optional()
    .describe("Filtro opcional por nombre de proyecto."),
});

export const SearchActivitiesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Texto de búsqueda, clave de actividad (ej. 'G114', 'CI095') o palabras clave de la descripción/notas/proyecto."),
  responsibleName: z
    .string()
    .optional()
    .describe("Filtro opcional por nombre o apellido del responsable (ej. 'Roberto Carlos', 'Adrian', 'Brayan')."),
  status: z
    .string()
    .default("All")
    .describe("Filtro de estado (InProgress, Pending, Completed, All)."),
  limit: z
    .number()
    .int()
    .default(20)
    .describe("Límite máximo de resultados."),
});

export const GetActivityDetailSchema = z.object({
  id: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico único (ej. 9758) o clave alfanumérica de la actividad (ej. 'CI095') a consultar."),
});

export const GetMetricsAndBalanceSchema = z.object({
  responsibleId: z
    .number()
    .int()
    .optional()
    .describe("ID del responsable (omita para usar el usuario autenticado por defecto)."),
  period: z
    .enum(["today", "current_week", "current_month", "custom"])
    .default("current_week")
    .describe("Periodo de cálculo del balance."),
  startDate: z
    .string()
    .optional()
    .describe(
      "Fecha inicio en formato ISO o YYYY-MM-DD (solo si period es custom).",
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      "Fecha fin en formato ISO o YYYY-MM-DD (solo si period es custom).",
    ),
});

export const GetMeetingsSchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe("Fecha inicio ISO para filtrar reuniones."),
  endDate: z
    .string()
    .optional()
    .describe("Fecha fin ISO para filtrar reuniones."),
  activityId: z
    .number()
    .int()
    .optional()
    .describe("ID de actividad para filtrar reuniones vinculadas."),
});

export const CreateMeetingSchema = z.object({
  title: z.string().min(3).describe("Título o asunto de la reunión."),
  description: z.string().optional().describe("Descripción o agenda de la reunión."),
  scheduledDate: z.string().describe("Fecha y hora programada en formato ISO 8601 (ej. '2026-10-05T09:00:00')."),
  durationMinutes: z.number().int().positive().default(30).describe("Duración en minutos (ej. 30, 60)."),
  location: z.string().default("Oficina / Teams").describe("Ubicación o enlace de Teams."),
  type: z.number().int().default(0).describe("Tipo de reunión (0 = Internal, 1 = Client, 2 = Planning, 3 = Review, 4 = Retrospective, 5 = Other)."),
  attendeeIds: z.array(z.number().int()).optional().describe("IDs de responsables asistentes (ej. [6, 31])."),
  activityKey: z.string().optional().describe("Clave de la actividad asociada."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad."),
});

export const UpdateMeetingSchema = z.object({
  id: z.number().int().describe("ID numérico de la reunión a actualizar."),
  title: z.string().optional().describe("Nuevo título o asunto."),
  description: z.string().optional().describe("Nueva descripción o temas tratados."),
  scheduledDate: z.string().optional().describe("Fecha y hora programada en formato ISO 8601."),
  durationMinutes: z.number().int().positive().optional().describe("Duración en minutos."),
  location: z.string().optional().describe("Ubicación o enlace."),
  type: z.number().int().optional().describe("Tipo de reunión (0 = Internal, 1 = Client, 2 = Planning, 3 = Review, 4 = Retrospective, 5 = Other)."),
  status: z.number().int().optional().describe("Estado de la reunión (0 = Scheduled, 1 = InProgress, 2 = Completed, 3 = Cancelled)."),
  notes: z.string().optional().describe("Bitácora o acuerdos de la reunión."),
  attendeeIds: z.array(z.number().int()).optional().describe("IDs de responsables asistentes."),
  activityKey: z.string().optional().describe("Clave de la actividad asociada."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad."),
});

export const DeleteMeetingSchema = z.object({
  id: z.number().int().describe("ID numérico único de la reunión a eliminar."),
  dryRun: z
    .boolean()
    .default(true)
    .describe("Modo simulación de seguridad. Especifique dryRun: false para eliminar realmente en la base de datos."),
});

export const GetCatalogsSchema = z.object({
  catalog: z
    .enum(["all", "projects", "services", "products", "sprints", "responsibles", "user"])
    .default("all")
    .describe("Catálogo específico a consultar dinámicamente."),
  projectId: z
    .number()
    .int()
    .optional()
    .describe("ID opcional de proyecto si se consultan sprints."),
});

export const CreateActivitySchema = z.object({
  description: z
    .string()
    .min(3)
    .describe("Descripción concisa de la actividad realizada o cuerpo del correo/ticket."),
  responsibleName: z
    .string()
    .optional()
    .describe(
      "Nombre o apellidos del responsable a quien asignar la actividad (ej. 'Adrian Garcia Richarte', 'Adrian'). Se resuelve dinámicamente si se omite responsibleId.",
    ),
  responsibleId: z
    .number()
    .int()
    .optional()
    .describe("ID numérico del responsable. Omita si especifica responsibleName o usa el usuario por defecto."),
  projectId: z
    .number()
    .int()
    .optional()
    .describe(
      "ID numérico de proyecto. Si se omite, se resuelve DINÁMICAMENTE desde la lista activa de la API.",
    ),
  projectName: z
    .string()
    .optional()
    .describe("Nombre o prefijo del proyecto para resolverlo dinámicamente (ej. 'Comunidad Informática', 'CI')."),
  serviceId: z
    .number()
    .int()
    .optional()
    .describe(
      "ID numérico de servicio. Si se omite, se resuelve DINÁMICAMENTE desde los servicios activos de la API.",
    ),
  type: z
    .string()
    .optional()
    .describe(
      "Tipo de actividad. Si se omite, se resuelve dinámicamente (Development, Maintenance, Planning, etc.).",
    ),
  priority: z
    .string()
    .default("Medium")
    .describe("Prioridad de la actividad (Low, Medium, High)."),
  status: z
    .string()
    .default("InProgress")
    .describe("Estado inicial (InProgress, Pending, Completed). Si se indica Completed, se establece el avance al 100% y la fecha de cierre automáticamente."),
  autoComplete: z
    .boolean()
    .default(false)
    .describe("Si es true, marca automáticamente la actividad como Completed al 100% con fecha de cierre real."),
  autoAdvanceStages: z
    .boolean()
    .default(false)
    .describe("Si es true, avanza dinámicamente TODAS las etapas del proceso del producto hasta completarlo en una sola ejecución."),
  estimatedHours: z
    .number()
    .positive()
    .optional()
    .describe("Horas estimadas o invertidas (ej. 2.5, 4)."),
  productId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "ID de producto o entregable. Obligatorio para registrar la actividad en producción y habilitar el seguimiento por etapas.",
    ),
  notes: z.string().optional().describe("Notas o acuerdos adicionales."),
  support: z.string().optional().describe("Ticket o referencia de soporte."),
  dryRun: z
    .boolean()
    .default(true)
    .describe(
      "Modo simulación de seguridad. IMPORTANTE: En true sólo simula. Especifique dryRun: false para guardar REALMENTE en la base de datos productiva.",
    ),
});

export const UpdateActivitySchema = z.object({
  id: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico único (ej. 9758) o clave de actividad (ej. 'CI095') a actualizar."),
  description: z
    .string()
    .optional()
    .describe("Nueva descripción o título de la actividad."),
  status: z
    .string()
    .optional()
    .describe("Nuevo estado (Pending, InProgress, Completed, Cancelled)."),
  progressPercentage: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Porcentaje de avance (0-100)."),
  responsibleId: z
    .number()
    .int()
    .optional()
    .describe("ID del responsable asignado a la actividad (permite editar o reasignar actividades de cualquier persona)."),
  responsibleName: z
    .string()
    .optional()
    .describe("Nombre o apellidos del responsable (ej. 'Adrian', 'Brayan'). Se resuelve dinámicamente si se omite responsibleId."),
  projectId: z
    .number()
    .int()
    .optional()
    .describe("ID numérico de proyecto."),
  projectName: z
    .string()
    .optional()
    .describe("Nombre o prefijo del proyecto."),
  serviceId: z
    .number()
    .int()
    .optional()
    .describe("ID numérico de servicio."),
  type: z
    .string()
    .optional()
    .describe("Tipo de actividad (Development, Maintenance, Planning, Support, etc.)."),
  priority: z
    .string()
    .optional()
    .describe("Prioridad de la actividad (Low, Medium, High)."),
  estimatedHours: z
    .number()
    .positive()
    .optional()
    .describe("Horas estimadas de la actividad."),
  actualStartDate: z
    .string()
    .optional()
    .describe("Fecha de inicio real en formato ISO o YYYY-MM-DD."),
  estimatedStartDate: z
    .string()
    .optional()
    .describe("Fecha de inicio estimada en formato ISO o YYYY-MM-DD."),
  estimatedDeliveryDate: z
    .string()
    .optional()
    .describe("Fecha de entrega estimada en formato ISO o YYYY-MM-DD."),
  actualCompletionDate: z
    .string()
    .optional()
    .describe("Fecha de entrega/cierre real en formato ISO o YYYY-MM-DD."),
  productId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "ID de producto o entregable para habilitar el seguimiento por etapas.",
    ),
  productApplicable: z
    .boolean()
    .optional()
    .describe(
      "Indica que la actividad utiliza seguimiento por producto y etapas.",
    ),
  notes: z.string().optional().describe("Bitácora o notas adicionales."),
  support: z.string().optional().describe("Ticket o referencia de soporte."),
  autoComplete: z
    .boolean()
    .default(false)
    .describe("Si es true, marca automáticamente la actividad como Completed al 100% y establece la fecha de cierre."),
  autoAdvanceStages: z
    .boolean()
    .default(false)
    .describe("Si es true, avanza dinámicamente todas las etapas pendientes del producto hasta completarlo."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad. Especifique dryRun: false para actualizar realmente en BD."),
});

export const GetProcessStagesSchema = z.object({
  productId: z
    .number()
    .int()
    .optional()
    .describe("ID de producto para consultar las etapas de proceso configuradas."),
  activityId: z
    .union([z.number().int(), z.string()])
    .optional()
    .describe("ID o clave de actividad para consultar su historial de etapas de proceso."),
});

export const AdvanceProcessStageSchema = z.object({
  activityId: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico o clave de la actividad (ej. 9758 o 'CI095')."),
  stageId: z
    .number()
    .int()
    .optional()
    .describe("ID de la etapa del proceso a la cual avanzar. Se puede omitir si advanceAll es true."),
  assignedToId: z
    .number()
    .int()
    .default(env.DEFAULT_RESPONSIBLE_ID)
    .describe("ID del responsable asignado a la etapa (6 = Brayan)."),
  advanceAll: z
    .boolean()
    .default(false)
    .describe("Si es true, avanza secuencialmente TODAS las etapas pendientes de la actividad hasta completarla en una sola llamada."),
  notes: z.string().optional().describe("Notas o comentarios de avance de etapa."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad. Especifique dryRun: false para ejecutar en producción."),
});

export const GetObservationsSchema = z.object({
  activityId: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico o clave de la actividad (ej. 9758 o 'CI095')."),
});

export const AddObservationSchema = z.object({
  activityId: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico o clave de la actividad (ej. 9758 o 'CI095')."),
  type: z
    .string()
    .default("General")
    .describe("Tipo de observación o nota (General, Blocker, Agreement, Risk, etc.)."),
  content: z.string().min(1).describe("Contenido o texto de la observación/nota."),
  collaboratorId: z
    .number()
    .int()
    .default(env.DEFAULT_RESPONSIBLE_ID)
    .describe("ID del colaborador (6 = Brayan)."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad."),
});

export const DeleteActivitySchema = z.object({
  id: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico (ej. 9758) o clave de la actividad (ej. 'CI095') a eliminar permanentemente."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad. En true, no elimina en la base de datos productiva."),
});

export const CloseActivitySchema = z.object({
  id: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico o clave de la actividad que se concluye (ej. 9758 o 'CI095')."),
  actualHours: z
    .number()
    .positive()
    .optional()
    .describe("Horas reales dedicadas a la tarea."),
  completionNotes: z
    .string()
    .optional()
    .describe("Resumen de cierre o entregables."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad."),
});

export const LogWorkHoursSchema = z.object({
  activityId: z
    .union([z.number().int(), z.string()])
    .optional()
    .describe("ID o clave de la actividad asociada."),
  stageProgressId: z
    .number()
    .int()
    .optional()
    .describe("ID del avance de etapa (opcional)."),
  hoursWorked: z
    .number()
    .positive()
    .describe("Cantidad de horas a registrar (ej. 1.5, 3)."),
  workDate: z
    .string()
    .default(() => new Date().toISOString())
    .describe("Fecha en la que se laboró (ISO 8601 o YYYY-MM-DD)."),
  notes: z
    .string()
    .optional()
    .describe("Detalle de tareas o commits correspondientes a estas horas."),
  responsibleId: z
    .number()
    .int()
    .optional()
    .describe("ID del responsable (omita para usar el usuario autenticado por defecto)."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad."),
});

export const UploadEvidenceFileSchema = z.object({
  activityId: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico de la actividad (ej. 9758) o clave de actividad (ej. 'CI095')."),
  fileName: z
    .string()
    .optional()
    .describe("Nombre del archivo de evidencia (ej. 'CI095.md', 'evidencia.txt', 'captura.png')."),
  content: z
    .string()
    .optional()
    .describe("Contenido en texto plano o markdown del archivo a subir como evidencia. RECOMENDADO para asistentes IA / entornos en contenedor Podman."),
  fileContent: z
    .string()
    .optional()
    .describe("Alias de 'content'. Texto del archivo a subir."),
  fileContentBase64: z
    .string()
    .optional()
    .describe("Contenido codificado en Base64 para archivos binarios (imágenes, PDFs, zips)."),
  filePath: z
    .string()
    .optional()
    .describe("Ruta del archivo local (solo si el servidor corre localmente con acceso a esa ruta en disco)."),
  description: z
    .string()
    .optional()
    .describe("Descripción breve o justificación de la evidencia."),
  mimeType: z
    .string()
    .optional()
    .describe("Tipo MIME opcional (ej. 'text/markdown', 'image/png')."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad. Especifique dryRun: false para subir realmente a la API."),
});

export const AttachEvidenceUrlSchema = z.object({
  activityId: z
    .union([z.number().int(), z.string()])
    .describe("ID numérico de la actividad (ej. 9758) o clave de actividad (ej. 'CI095')."),
  url: z
    .string()
    .url()
    .describe("URL válida de evidencia (Merge Request GitLab, commit, docs)."),
  description: z.string().optional().describe("Descripción del enlace."),
  dryRun: z.boolean().default(true).describe("Modo simulación de seguridad."),
});

export const GetIncidenciasSchema = z.object({
  responsibleId: z
    .number()
    .int()
    .optional()
    .describe("ID del responsable (omita para usar el usuario autenticado por defecto)."),
  year: z.number().int().optional().describe("Año opcional para filtrar (ej. 2026)."),
  month: z.number().int().optional().describe("Mes opcional para filtrar (1-12)."),
});

export const CreateIncidenciaSchema = z.object({
  type: z
    .string()
    .default("Asueto")
    .describe("Tipo de incidencia (Asueto, Vacaciones, Permiso, Omisión, Incapacidad)."),
  startDate: z
    .string()
    .describe("Fecha inicio en formato YYYY-MM-DD o ISO 8601 (ej. '2026-11-02')."),
  endDate: z
    .string()
    .describe("Fecha fin en formato YYYY-MM-DD o ISO 8601 (ej. '2026-11-02')."),
  hours: z
    .number()
    .optional()
    .describe("Horas de incidencia si es parcial. Omitir si es día completo."),
  notes: z
    .string()
    .optional()
    .describe("Notas o motivo de la incidencia (ej. 'Día de muertos')."),
  responsibleId: z
    .number()
    .int()
    .optional()
    .describe("ID del responsable (omita para usar el usuario autenticado por defecto)."),
  dryRun: z
    .boolean()
    .default(true)
    .describe("Modo simulación de seguridad."),
});

export const DeleteIncidenciaSchema = z.object({
  id: z.number().int().describe("ID numérico de la incidencia a eliminar."),
  dryRun: z
    .boolean()
    .default(true)
    .describe("Modo simulación de seguridad."),
});

// ============================================================================
// DEFINICIÓN DE TOOLS PARA EL PROTOCOLO MCP
// ============================================================================

export function getToolDefinitions() {
  const toJsonSchemaClean = (schema: z.ZodTypeAny) => {
    const json = zodToJsonSchema(schema, { target: "jsonSchema7" }) as any;
    delete json.$schema;
    return json;
  };

  return [
    {
      name: "track_get_sprint_work_items",
      description:
        "Consulta los Work Items (historias, bugs, tareas) asignados a un Sprint. Si no se especifica sprintId, resuelve DINÁMICAMENTE el último sprint activo del proyecto. Operación 100% de LECTURA segura.",
      inputSchema: toJsonSchemaClean(GetSprintWorkItemsSchema),
    },
    {
      name: "track_sync_sprints",
      description:
        "Sincroniza dinámicamente los Sprints y Work Items de un proyecto con Azure DevOps / Azure Boards. Si no se especifican IDs, resuelve el proyecto y su último sprint en tiempo real desde la API.",
      inputSchema: toJsonSchemaClean(SyncSprintsSchema),
    },
    {
      name: "track_get_my_activities",
      description:
        "Consulta las actividades asignadas en el sistema a cualquier responsable o al usuario autenticado (responsibleId: 6). Operación 100% de LECTURA segura.",
      inputSchema: toJsonSchemaClean(GetMyActivitiesSchema),
    },
    {
      name: "track_search_activities",
      description:
        "Buscador global de actividades en todo el sistema por clave (ej. 'G114', 'CI095'), descripción, proyecto o responsable. Útil cuando una actividad no pertenece al usuario autenticado o se desconoce el responsable. Operación 100% LECTURA.",
      inputSchema: toJsonSchemaClean(SearchActivitiesSchema),
    },
    {
      name: "track_get_activity_detail",
      description:
        "Obtiene el detalle completo de una actividad por su ID numérico o clave alfanumérica (ej. 9758, 'CI095', 'G114'). Operación 100% de LECTURA.",
      inputSchema: toJsonSchemaClean(GetActivityDetailSchema),
    },
    {
      name: "track_get_metrics_and_balance",
      description:
        "Calcula el balance de horas laboradas por el responsable vs. la capacidad institucional (semanal o mensual) en tiempo real.",
      inputSchema: toJsonSchemaClean(GetMetricsAndBalanceSchema),
    },
    {
      name: "track_get_meetings",
      description:
        "Consulta las reuniones programadas o concluidas en el sistema para vincularlas con actividades o justificar tiempos. Operación 100% de LECTURA.",
      inputSchema: toJsonSchemaClean(GetMeetingsSchema),
    },
    {
      name: "track_create_meeting",
      description:
        "Registra una nueva reunión en el sistema con asistentes y tipo de sesión. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(CreateMeetingSchema),
    },
    {
      name: "track_update_meeting",
      description:
        "Actualiza el estado, título, temas o acuerdos de una reunión existente. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(UpdateMeetingSchema),
    },
    {
      name: "track_delete_meeting",
      description:
        "Elimina una reunión agendada o registrada en el sistema por su ID numérico. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(DeleteMeetingSchema),
    },
    {
      name: "track_get_catalogs",
      description:
        "Consulta los catálogos en tiempo real (34+ Proyectos activos, 8 Servicios, Productos, Sprints y Tipos). Operación 100% de LECTURA.",
      inputSchema: toJsonSchemaClean(GetCatalogsSchema),
    },
    {
      name: "track_get_process_stages",
      description:
        "Consulta las etapas de proceso asociadas a un producto o el historial de etapas de una actividad.",
      inputSchema: toJsonSchemaClean(GetProcessStagesSchema),
    },
    {
      name: "track_advance_process_stage",
      description:
        "Avanza una actividad a una nueva etapa del proceso de producto. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(AdvanceProcessStageSchema),
    },
    {
      name: "track_get_observations",
      description:
        "Consulta las observaciones y notas registradas en una actividad.",
      inputSchema: toJsonSchemaClean(GetObservationsSchema),
    },
    {
      name: "track_add_observation",
      description:
        "Agrega una nota u observación de cualquier tipo (General, Blocker, Agreement, Risk, etc.) a una actividad. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(AddObservationSchema),
    },
    {
      name: "track_create_activity",
      description:
        "Registra una nueva actividad. Si no se indican projectId o serviceId, los resuelve DINÁMICAMENTE de la lista en tiempo real de la API. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(CreateActivitySchema),
    },
    {
      name: "track_update_activity",
      description:
        "Actualiza el progreso, estado o notas de una actividad. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(UpdateActivitySchema),
    },
    {
      name: "track_close_activity",
      description:
        "Concluye y cierra una actividad marcándola al 100% y estado Completed. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(CloseActivitySchema),
    },
    {
      name: "track_delete_activity",
      description:
        "Elimina permanentemente una actividad por su ID numérico. SEGURIDAD EXTREMA: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(DeleteActivitySchema),
    },
    {
      name: "track_log_work_hours",
      description:
        "Registra horas trabajadas en una fecha sobre una actividad. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(LogWorkHoursSchema),
    },
    {
      name: "track_upload_evidence_file",
      description:
        "Adjunta un archivo local como evidencia. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(UploadEvidenceFileSchema),
    },
    {
      name: "track_attach_evidence_url",
      description:
        "Adjunta una URL de evidencia. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(AttachEvidenceUrlSchema),
    },
    {
      name: "track_get_incidencias",
      description:
        "Consulta las incidencias del responsable (Asuetos, Vacaciones, Permisos, Omisiones, Incapacidades). Operación 100% LECTURA.",
      inputSchema: toJsonSchemaClean(GetIncidenciasSchema),
    },
    {
      name: "track_create_incidencia",
      description:
        "Registra una incidencia (Asueto, Vacaciones, Permiso, Omisión, Incapacidad). SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(CreateIncidenciaSchema),
    },
    {
      name: "track_delete_incidencia",
      description:
        "Elimina una incidencia por su ID. SEGURIDAD: Modo Dry-Run activo por defecto.",
      inputSchema: toJsonSchemaClean(DeleteIncidenciaSchema),
    },
  ];
}

// ============================================================================
// DESPACHADOR CENTRAL DE LLAMADAS (CALL TOOL)
// ============================================================================

export async function handleToolCall(
  name: string,
  args: unknown,
): Promise<any> {
  switch (name) {
    case "track_get_sprint_work_items": {
      const parsed = GetSprintWorkItemsSchema.parse(args || {});
      const liveProjects = await catalogService.getProjects();

      let targetProjectId = parsed.projectId;
      if (!targetProjectId && parsed.projectName) {
        const resolved = catalogService.getProjects();
        const found = (await resolved).find(
          (p) =>
            p.name?.toLowerCase().includes(parsed.projectName!.toLowerCase()) ||
            p.prefix?.toLowerCase() === parsed.projectName!.toLowerCase(),
        );
        if (found) targetProjectId = found.id;
      }

      if (!targetProjectId) {
        targetProjectId = env.DEFAULT_PROJECT_ID;
      }

      return await sprintService.getSprintWorkItems(
        parsed.sprintId,
        targetProjectId,
        parsed.assignedTo,
      );
    }

    case "track_sync_sprints": {
      const parsed = SyncSprintsSchema.parse(args || {});
      let targetProjectId = parsed.projectId;

      if (!targetProjectId && parsed.projectName) {
        const liveProjects = await catalogService.getProjects();
        const found = liveProjects.find(
          (p) =>
            p.name?.toLowerCase().includes(parsed.projectName!.toLowerCase()) ||
            p.prefix?.toLowerCase() === parsed.projectName!.toLowerCase(),
        );
        if (found) targetProjectId = found.id;
      }

      if (!targetProjectId) {
        targetProjectId = env.DEFAULT_PROJECT_ID;
      }

      return await sprintService.syncLatestSprintForProject(
        targetProjectId,
        parsed.sprintId,
      );
    }

    case "track_get_my_activities": {
      const parsed = GetMyActivitiesSchema.parse(args || {});
      let targetProjectId = parsed.projectId;

      if (!targetProjectId && parsed.projectName) {
        const liveProjects = await catalogService.getProjects();
        const found = liveProjects.find(
          (p) =>
            p.name?.toLowerCase().includes(parsed.projectName!.toLowerCase()) ||
            p.prefix?.toLowerCase() === parsed.projectName!.toLowerCase(),
        );
        if (found) targetProjectId = found.id;
      }

      let targetResponsibleId = parsed.responsibleId;
      if (!targetResponsibleId && parsed.responsibleName) {
        const liveResponsibles = await catalogService.getResponsibles();
        const resolved = resolveResponsibleFromText(parsed.responsibleName, liveResponsibles);
        targetResponsibleId = resolved.id;
      }

      return await activityService.getMyActivities(
        targetResponsibleId,
        parsed.status,
        targetProjectId,
      );
    }

    case "track_search_activities": {
      const parsed = SearchActivitiesSchema.parse(args || {});
      return await activityService.searchActivities(
        parsed.query,
        parsed.responsibleName,
        parsed.status,
        parsed.limit,
      );
    }

    case "track_get_activity_detail": {
      const parsed = GetActivityDetailSchema.parse(args || {});
      return await activityService.getActivityDetail(parsed.id);
    }

    case "track_get_metrics_and_balance": {
      const parsed = GetMetricsAndBalanceSchema.parse(args || {});
      return await timesheetService.getWorkBalanceMetrics(
        parsed.responsibleId,
        parsed.period,
        parsed.startDate,
        parsed.endDate,
      );
    }

    case "track_get_meetings": {
      const parsed = GetMeetingsSchema.parse(args || {});
      return await meetingService.getMeetings(
        parsed.startDate,
        parsed.endDate,
        parsed.activityId,
      );
    }

    case "track_create_meeting": {
      const parsed = CreateMeetingSchema.parse(args || {});
      return await meetingService.createMeeting(
        {
          title: parsed.title,
          description: parsed.description,
          scheduledDate: parsed.scheduledDate,
          durationMinutes: parsed.durationMinutes,
          location: parsed.location,
          type: parsed.type,
          attendeeIds: parsed.attendeeIds,
          activityKey: parsed.activityKey,
        },
        parsed.dryRun,
      );
    }

    case "track_update_meeting": {
      const parsed = UpdateMeetingSchema.parse(args || {});
      return await meetingService.updateMeeting(
        parsed.id,
        {
          title: parsed.title,
          description: parsed.description,
          scheduledDate: parsed.scheduledDate,
          durationMinutes: parsed.durationMinutes,
          location: parsed.location,
          type: parsed.type,
          status: parsed.status,
          notes: parsed.notes,
          attendeeIds: parsed.attendeeIds,
          activityKey: parsed.activityKey,
        },
        parsed.dryRun,
      );
    }

    case "track_delete_meeting": {
      const parsed = DeleteMeetingSchema.parse(args || {});
      return await meetingService.deleteMeeting(parsed.id, parsed.dryRun);
    }

    case "track_get_catalogs": {
      const parsed = GetCatalogsSchema.parse(args || {});
      if (parsed.catalog === "projects")
        return await catalogService.getProjects();
      if (parsed.catalog === "services")
        return await catalogService.getServices();
      if (parsed.catalog === "products")
        return await catalogService.getProducts();
      if (parsed.catalog === "sprints")
        return await catalogService.getSprints(parsed.projectId);
      if (parsed.catalog === "responsibles") {
        return await catalogService.getResponsibles();
      }
      if (parsed.catalog === "user") {
        await authManager.getValidToken();
        const user = authManager.getCachedResponsible();
        return {
          authenticatedUser: {
            id: authManager.getResponsibleId(),
            fullName: authManager.getResponsibleName(),
            username: env.AUTH_USERNAME,
            defaultServiceId: authManager.getDefaultServiceId(),
            details: user
          }
        };
      }
      const summary = await catalogService.getAllCatalogsSummary();
      summary.authenticatedUser = {
        id: authManager.getResponsibleId(),
        fullName: authManager.getResponsibleName(),
        username: env.AUTH_USERNAME,
        defaultServiceId: authManager.getDefaultServiceId(),
      };
      return summary;
    }

    case "track_create_activity": {
      const parsed = CreateActivitySchema.parse(args || {});

      // 1. Obtener proyectos, servicios y responsables activos dinámicamente
      const liveProjects = await catalogService.getProjects();
      const liveServices = await catalogService.getServices();
      const liveResponsibles = await catalogService.getResponsibles();

      // 2. Inferencia dinámica sobre los datos en vivo (limpia correos y resuelve entidades)
      const inferred = inferActivityMetadata(
        parsed.description,
        liveProjects,
        liveServices,
        liveResponsibles,
      );

      // Resolver proyecto objetivo por ID, por nombre/prefijo o por inferencia
      let targetProjectId = parsed.projectId || inferred.projectId;
      if (parsed.projectName) {
        const foundProj = liveProjects.find(
          (p) =>
            p.name?.toLowerCase().includes(parsed.projectName!.toLowerCase()) ||
            p.prefix?.toLowerCase() === parsed.projectName!.toLowerCase()
        );
        if (foundProj) targetProjectId = foundProj.id;
      }

      // Resolver responsable objetivo por ID, por nombre o por inferencia
      let targetResponsibleId = parsed.responsibleId || inferred.responsibleId;
      if (parsed.responsibleName) {
        const resolvedResp = resolveResponsibleFromText(
          parsed.responsibleName,
          liveResponsibles,
        );
        targetResponsibleId = resolvedResp.id;
      }

      const cleanedDescription = cleanEmailOrTicketText(parsed.description);
      const standardizedTitle = formatStandardizedTitle(cleanedDescription, inferred.projectName);

      const isCompleted = parsed.status === "Completed" || parsed.autoComplete;
      const nowIso = new Date().toISOString();

      const payload: any = {
        description: standardizedTitle,
        projectId: targetProjectId,
        serviceId: parsed.serviceId || inferred.serviceId,
        type: parsed.type || inferred.type,
        priority: parsed.priority || inferred.priority,
        status: isCompleted ? "Completed" : parsed.status,
        progressPercentage: isCompleted ? 100 : 0,
        estimatedHours: parsed.estimatedHours || inferred.estimatedHours || 2.0,
        actualStartDate: isCompleted ? nowIso : undefined,
        actualCompletionDate: isCompleted ? nowIso : undefined,
        productApplicable: parsed.productId !== undefined,
        productId: parsed.productId,
        notes: parsed.notes,
        support: parsed.support,
        responsibleId: targetResponsibleId,
      };

      const creationResult = await activityService.createActivity(payload, parsed.dryRun);

      // Avanzar etapas automáticamente si autoAdvanceStages o autoComplete es true
      if ((parsed.autoAdvanceStages || parsed.autoComplete) && creationResult) {
        const actId = creationResult.id || creationResult.simulatedActivityId;
        if (actId) {
          const stageAdvanceResult = await activityService.advanceAllProcessStages(
            actId,
            targetResponsibleId,
            "Avance automático de etapas al crear/completar actividad",
            parsed.dryRun,
            parsed.productId
          );
          return {
            ...creationResult,
            stageAdvancement: stageAdvanceResult,
            message: `${creationResult.message || ''} Etapas de proceso avanzadas automáticamente.`,
          };
        }
      }

      return creationResult;
    }

    case "track_update_activity": {
      const parsed = UpdateActivitySchema.parse(args || {});
      const liveProjects = await catalogService.getProjects();
      const liveResponsibles = await catalogService.getResponsibles();

      let targetProjectId = parsed.projectId;
      if (!targetProjectId && parsed.projectName) {
        const found = liveProjects.find(
          (p) =>
            p.name?.toLowerCase().includes(parsed.projectName!.toLowerCase()) ||
            p.prefix?.toLowerCase() === parsed.projectName!.toLowerCase()
        );
        if (found) targetProjectId = found.id;
      }

      let targetResponsibleId = parsed.responsibleId;
      if (!targetResponsibleId && parsed.responsibleName) {
        const resolvedResp = resolveResponsibleFromText(parsed.responsibleName, liveResponsibles);
        targetResponsibleId = resolvedResp.id;
      }

      const isCompleted = parsed.status === "Completed" || parsed.autoComplete;
      const nowIso = new Date().toISOString();

      const updateData: any = {
        description: parsed.description,
        status: isCompleted ? "Completed" : parsed.status,
        progressPercentage: isCompleted ? 100 : parsed.progressPercentage,
        responsibleId: targetResponsibleId,
        projectId: targetProjectId,
        serviceId: parsed.serviceId,
        type: parsed.type,
        priority: parsed.priority,
        estimatedHours: parsed.estimatedHours,
        actualStartDate: parsed.actualStartDate || (isCompleted ? nowIso : undefined),
        estimatedStartDate: parsed.estimatedStartDate,
        estimatedDeliveryDate: parsed.estimatedDeliveryDate,
        actualCompletionDate: parsed.actualCompletionDate || (isCompleted ? nowIso : undefined),
        productId: parsed.productId,
        productApplicable: parsed.productApplicable,
        notes: parsed.notes,
        support: parsed.support,
      };

      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined) delete updateData[key];
      });

      const updateResult = await activityService.updateActivity(
        parsed.id,
        updateData,
        parsed.dryRun,
      );

      if (parsed.autoAdvanceStages && updateResult) {
        const numericId = await activityService.resolveNumericActivityId(parsed.id);
        const stageAdvanceResult = await activityService.advanceAllProcessStages(
          numericId,
          targetResponsibleId || env.DEFAULT_RESPONSIBLE_ID,
          "Avance automático de etapas al actualizar actividad",
          parsed.dryRun,
          parsed.productId
        );
        return {
          ...updateResult,
          stageAdvancement: stageAdvanceResult,
          message: `${updateResult.message || ''} Etapas de proceso avanzadas automáticamente.`,
        };
      }

      return updateResult;
    }

    case "track_get_process_stages": {
      const parsed = GetProcessStagesSchema.parse(args || {});
      if (parsed.productId) {
        return await activityService.getProcessStagesByProduct(parsed.productId);
      }
      if (parsed.activityId) {
        const numericId = await activityService.resolveNumericActivityId(parsed.activityId);
        return await activityService.getProcessStageHistory(numericId);
      }
      throw new Error("Debe proporcionar productId o activityId para consultar las etapas.");
    }

    case "track_advance_process_stage": {
      const parsed = AdvanceProcessStageSchema.parse(args || {});
      const numericId = await activityService.resolveNumericActivityId(parsed.activityId);
      if (parsed.advanceAll) {
        return await activityService.advanceAllProcessStages(
          numericId,
          parsed.assignedToId,
          parsed.notes,
          parsed.dryRun,
        );
      }
      if (!parsed.stageId) {
        throw new Error("Debe especificar stageId o pasar advanceAll: true para avanzar automáticamente todas las etapas.");
      }
      return await activityService.advanceProcessStage(
        numericId,
        parsed.stageId,
        parsed.assignedToId,
        parsed.notes,
        parsed.dryRun,
      );
    }

    case "track_get_observations": {
      const parsed = GetObservationsSchema.parse(args || {});
      const numericId = await activityService.resolveNumericActivityId(parsed.activityId);
      return await activityService.getObservations(numericId);
    }

    case "track_add_observation": {
      const parsed = AddObservationSchema.parse(args || {});
      const numericId = await activityService.resolveNumericActivityId(parsed.activityId);
      return await activityService.addObservation(
        numericId,
        parsed.type,
        parsed.content,
        parsed.collaboratorId,
        parsed.dryRun,
      );
    }

    case "track_close_activity": {
      const parsed = CloseActivitySchema.parse(args || {});
      return await activityService.closeActivity(
        parsed.id,
        parsed.actualHours,
        parsed.completionNotes,
        parsed.dryRun,
      );
    }

    case "track_delete_activity": {
      const parsed = DeleteActivitySchema.parse(args || {});
      return await activityService.deleteActivity(parsed.id, parsed.dryRun);
    }

    case "track_log_work_hours": {
      const parsed = LogWorkHoursSchema.parse(args || {});
      const numericId = parsed.activityId ? await activityService.resolveNumericActivityId(parsed.activityId) : undefined;
      return await timesheetService.logWorkHours(
        {
          activityId: numericId,
          stageProgressId: parsed.stageProgressId,
          hoursWorked: parsed.hoursWorked,
          workDate: parsed.workDate,
          notes: parsed.notes,
          responsibleId: parsed.responsibleId,
        },
        parsed.dryRun,
      );
    }

    case "track_upload_evidence_file": {
      const parsed = UploadEvidenceFileSchema.parse(args || {});
      return await evidenceService.uploadEvidenceFile(
        parsed.activityId,
        {
          filePath: parsed.filePath,
          fileName: parsed.fileName,
          content: parsed.content,
          fileContent: parsed.fileContent,
          fileContentBase64: parsed.fileContentBase64,
          description: parsed.description,
          mimeType: parsed.mimeType,
        },
        parsed.description,
        parsed.dryRun,
      );
    }

    case "track_attach_evidence_url": {
      const parsed = AttachEvidenceUrlSchema.parse(args || {});
      return await evidenceService.attachEvidenceUrl(
        parsed.activityId,
        parsed.url,
        parsed.description,
        parsed.dryRun,
      );
    }

    case "track_get_incidencias": {
      const parsed = GetIncidenciasSchema.parse(args || {});
      return await incidenceService.getIncidencias(
        parsed.responsibleId,
        parsed.year,
        parsed.month,
      );
    }

    case "track_create_incidencia": {
      const parsed = CreateIncidenciaSchema.parse(args || {});
      return await incidenceService.createIncidencia(
        {
          responsibleId: parsed.responsibleId,
          type: parsed.type,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          hours: parsed.hours,
          notes: parsed.notes,
        },
        parsed.dryRun,
      );
    }

    case "track_delete_incidencia": {
      const parsed = DeleteIncidenciaSchema.parse(args || {});
      return await incidenceService.deleteIncidencia(parsed.id, parsed.dryRun);
    }

    default:
      throw new Error(`Herramienta desconocida: '${name}'`);
  }
}
