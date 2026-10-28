# Notas operativas para asistentes de IA (Activity Tracking MCP)

Este documento recopila comportamientos reales observados al operar este conector
desde un cliente de IA (Claude), más allá de lo que describen por sí solos los
nombres y parámetros de las tools. El texto corto equivalente vive también en el
campo `instructions` del servidor (`src/index.ts`), que los clientes MCP cargan
automáticamente al conectarse; aquí está el detalle y el contexto de cada regla.

## 1. Ciclo de vida automático y cierre de actividades por etapas (v3.11.0 – v3.13.0)

A partir de las versiones v3.11 a v3.13 del backend Kestrel, **el Estado y el % de Progreso de una actividad ya no se editan a mano**:
- Al crear una actividad nace en estado **`Pending`** con 0% de progreso.
- Al avanzar de etapa (`track_advance_process_stage`), el estado pasa automáticamente a **`InProgress`** y se fija `actualStartDate`.
- El progreso porcentual se reporta en cada registro de tiempo (`track_log_work_hours`) enviando el campo **`progressDelta`** (ej. `+25` para sumar 25 puntos porcentuales, o `-10` si retrocedió). El backend recalcula y acota automáticamente la suma acumulada entre 0 y 100%.
- Para concluir una actividad, se utiliza **`track_close_activity`**, la cual invoca el endpoint oficial del seguimiento por etapas:
  `POST /api/v1/process-stages/activity/{id}/complete`
  Esto cierra la etapa en curso (que debe ser la de mayor orden) y marca la actividad como **`Completed`**.
- Para cancelar una actividad en cualquier momento (incluso sin etapa activa), se utiliza **`track_cancel_activity`** (`POST /api/v1/process-stages/activity/{id}/cancel`), la cual cierra la etapa activa sin marcar la actividad como completada (pasa a **`Cancelled`**).
- Para reabrir una actividad completada o cancelada, se utiliza **`track_reopen_activity`** (`POST /api/v1/process-stages/activity/{id}/reopen`), que reabre la última etapa cerrada y regresa el estado a **`InProgress`** (o `Pending`), limpiando la fecha de finalización.
- Para consultar rápidamente la etapa activa actual de una actividad (su `stageProgressId`, orden, responsable y horas reales acumuladas), se utiliza **`track_get_current_process_stage`** (`GET /api/v1/process-stages/activity/{id}/current`).
- En observaciones (`track_add_observation`), el tipo `"Progreso"` fue retirado en favor de `"Resolución"` (para marcar bloqueadores como resueltos).

Regla para actividades con producto (`productApplicable: true`):
> Antes de cerrar una actividad, debe recorrer cada una de las etapas configuradas en su producto y registrar en cada una de ellas el responsable y las horas trabajadas. Una vez en la etapa final, se invoca `track_close_activity`.

### Caso real: AR023 (id 10798, producto 16 "Implementación de sistemas...")

- `track_advance_process_stage({ activityId: 10798, advanceAll: true, dryRun: true })`
  devolvió `stagesAdvancedCount: 0` — **falso negativo** (ver punto 2 abajo).
- `track_advance_process_stage({ activityId: 10798, stageId: 120 /* Cierre y
  registro de evidencias */, assignedToId: 1, dryRun: false })` sí avanzó la
  etapa y devolvió `{ id: 1382, ... }` → ese `1382` es el `stageProgressId`.
- `track_log_work_hours({ activityId: 10798, stageProgressId: 1382,
  hoursWorked: 2, dryRun: false })` registró las horas correctamente.
- `track_update_activity({ id: 10798, status: "Completed",
  progressPercentage: 100, ... })` cerró la actividad.

## 2. `track_advance_process_stage` con `advanceAll: true`: dry-run poco confiable

En `activity-service.ts::advanceAllProcessStages`, la consulta de etapas del
producto (`getProcessStagesByProduct`) **solo se ejecuta si se pasa `productId`
explícito, o si `!isDryRun`**. En dry-run sin `productId`, `stages` queda `[]`
siempre, y la tool responde "no se requirieron etapas adicionales... o la
actividad no tiene producto asignado" — aunque en modo real sí haya etapas
pendientes. No usar ese mensaje en dry-run como señal de "nada que hacer"; pasar
`productId` explícito al dry-run, o verificar aparte con
`track_get_process_stages({ productId })`.

## 3. `track_log_work_hours`: `stageProgressId` obligatorio solo en modo real

El dry-run siempre responde `SIMULATION_SUCCESS` con
`targetEndpoint: ".../by-progress/AUTO_RESOLVED"` sin pedir `stageProgressId`.
En modo real, si la actividad usa flujo de etapas, la API exige
`stageProgressId` y rechaza la llamada si falta ("stageProgressId es requerido
para el registro en modo real"). Un dry-run exitoso **no** garantiza que el real
funcione — hay que obtener el `stageProgressId` primero (ver sección 1).

## 4. Asignación automática al usuario autenticado (sin IDs fijos)

Todas las actividades, incidencias, registros de horas, avances de etapa y observaciones se asignan automáticamente al usuario autenticado en la sesión activa (`authManager.getResponsibleId()`).
NO existen usuarios ni IDs fijados por omisión (se eliminó cualquier fallback rígido al usuario ID 6).
Para crear o asignar una actividad o etapa a uno mismo, basta con omitir `responsibleId` y `responsibleName` (o usar "yo").
Únicamente se debe pasar un `responsibleId` o `responsibleName` explícito cuando el usuario indique explícitamente que desea asignarle algo a una persona distinta a él.










## 5. Catálogo de tipos: "Desing" (typo oficial)

`FALLBACK_ACTIVITY_TYPES` en `src/config/constants.ts` incluye el literal
`'Desing'` con el comentario "Ortografía oficial del backend". Pasar `type:
"Design"` en modo real es rechazado ("Tipo de actividad inválido: 'Design'.
Verifica el catálogo de tipos."), aunque el dry-run lo acepta sin validar contra
catálogo real. Usar siempre `"Desing"` para la categoría de diseño.

## 7. Servicio/producto inconsistente

Si se pasa `productId` de un servicio distinto al que se resuelve dinámicamente
a partir de `type`/`projectId`, la API rechaza con: "El producto X pertenece al
servicio Y, no al servicio Z". Solución: pasar `serviceId` explícito que
coincida con el servicio real del producto (consultable vía
`track_get_catalogs`).

## 8. `type` no es editable de forma confiable después de creación

En una instalación de este conector probada en producción, el schema de
`track_update_activity` expuesto al cliente IA **no incluía el campo `type`**
en absoluto (no estaba en el `inputSchema` real recibido por el cliente MCP),
aunque el código fuente de este repo (`UpdateActivitySchema` en
`src/tools/index.ts`) sí lo define. Ver sección 9 sobre posible desfase de
versión. Mientras no se confirme que la instalación desplegada soporta cambiar
`type` vía update, tratarlo como no editable: la única vía para corregir un
`type` mal asignado es eliminar y recrear la actividad — lo cual puede
desvincular horas de apoyo/colaboradores (`isSupport`) registradas contra el id
original. **Pedir confirmación explícita al usuario antes de borrar una
actividad para cambiarle el tipo**, y preferir dejarlo así si existen horas de
colaboradores asociadas.

## 9. `track_get_my_activities`: sin filtro de rango de fechas

La tool no acepta rango de fechas; con `status: "All"` en responsables con
mucho historial, la respuesta puede exceder el límite de tokens del cliente y
guardarse en un archivo en vez de devolverse inline. Para auditorías por mes o
por servicio, hay que traer todo (`status: "All"`) y filtrar del lado del
cliente por substring de fecha y `serviceName`.

Además, una misma actividad puede aparecer en las consultas de varios
`responsibleId` distintos cuando hay colaboradores registrando horas de apoyo
(`isSupport: true`) contra la actividad principal de otra persona. Para
deduplicar, usar el campo `id` de la actividad (no una combinación de
responsable+descripción), y confiar en `responsibleName` — no en el
`responsibleId` usado para la consulta — para saber quién es el dueño real.

## 9. Posible desfase entre `src/` (este repo) y lo realmente desplegado

El repo trae, además del código fuente, dos paquetes pre-construidos:
`activity-tracking.dxt` y `activity-tracking.mcpb` (~7 MB cada uno). Si el
conector instalado en el cliente de escritorio corre desde uno de esos
paquetes y no desde `src/` directamente, cualquier cambio a este código
(incluyendo las `instructions` y descripciones agregadas en esta sesión) **no
tendrá efecto hasta reconstruir y reinstalar el paquete**. Se observó en vivo
que el `inputSchema` real de `track_update_activity` carecía de campos que sí
están en `UpdateActivitySchema` de este `src/` (`type`, `responsibleId`,
`projectId`, `priority`, `autoAdvanceStages`, etc.), lo que sugiere que la
instalación activa corre una versión más antigua que `origin/main`.
Recomendación: confirmar qué build está realmente en uso y, si aplica,
reconstruir (`npm run build` o el script de empaquetado correspondiente) y
reinstalar el `.dxt`/`.mcpb` después de cualquier cambio a `src/`.

## 10. Seguridad general

Todas las tools de escritura tienen `dryRun: true` por defecto
("SEGURIDAD: Modo Dry-Run activo por defecto"). El patrón de trabajo seguro es
siempre: dry-run → validar el payload simulado → repetir con `dryRun: false`
solo si el dry-run refleja exactamente lo esperado.

## 11. Reporte de fallas técnicas (Issues) y propuestas de mejora (Ideas)

- La API de AppIssues (`POST /api/v1/AppIssues`) exige el campo multipart `Type` (`"Issue"` o `"Idea"`), `Title`, `Description` y `Severity`.
- Para proponer nuevas funciones o mejoras institucionales, usa **`track_submit_idea`** (o `track_report_app_issue` con `type: "Idea"`).
- Para reportar errores técnicos, bugs o problemas operativos, usa **`track_report_app_issue`** (por defecto `type: "Issue"`).
- Se puede adjuntar opcionalmente una captura de pantalla enviándola en Base64 (`screenshotBase64`) o indicando la ruta a un archivo de imagen en disco (`screenshotPath`).
- Severidades: `"Low"`, `"Medium"`, `"High"`, `"Critical"`. Si se omite, para `Idea` se asigna automáticamente `"Low"` y para `Issue` se asigna `"Medium"`.
- Para consultar o filtrar el backlog de fallas e ideas, **`track_get_app_issues`** incluye el filtro `type` (`"Issue"`, `"Idea"` o `"All"`).

