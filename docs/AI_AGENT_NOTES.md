# Notas operativas para asistentes de IA (Activity Tracking MCP)

Este documento recopila comportamientos reales observados al operar este conector
desde un cliente de IA (Claude), más allá de lo que describen por sí solos los
nombres y parámetros de las tools. El texto corto equivalente vive también en el
campo `instructions` del servidor (`src/index.ts`), que los clientes MCP cargan
automáticamente al conectarse; aquí está el detalle y el contexto de cada regla.

## 1. Cierre de actividades con producto (flujo por etapas)

`track_close_activity` **solo** hace `PUT status=Completed, progressPercentage=100`
(ver `activity-service.ts::closeActivity`). No toca el historial de etapas del
producto (`process-stages`) ni registra responsable/tiempo en ninguna etapa.

Si la actividad tiene `productApplicable: true` y su producto tiene un flujo de
etapas configurado (`track_get_process_stages({ productId })` devuelve etapas),
cerrarla "bien" significa que el histórico de "Progreso del Proceso" quede
completo, no solo el estado final. Regla acordada con el usuario:

> Al cerrar una actividad, debe pasar por cada etapa y en cada etapa registrarse
> un responsable y tiempo, en caso de que exista flujo de etapas.

Flujo recomendado:

1. `track_advance_process_stage` con `advanceAll: true` (o etapa por etapa con
   `stageId`), pasando `assignedToId` explícito — esto crea un registro de
   "stage progress" con responsable y fecha de inicio por etapa.
2. `track_log_work_hours` usando el `stageProgressId` devuelto por el paso 1
   (campo `id` de la respuesta de `advanceProcessStage`), con las horas reales.
3. Recién entonces `track_update_activity` (o `track_close_activity`) con
   `status: "Completed"`, `progressPercentage: 100`.

Atajo: `track_update_activity` con `autoAdvanceStages: true` hace el paso 1
automáticamente antes de guardar (ver `activity-service.ts`, caso
`track_update_activity`). Aun así, el registro de horas (paso 2) debe hacerse
aparte, porque `autoAdvanceStages` no registra tiempo.

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

## 4. `track_create_activity`: responsable por defecto

`DEFAULT_RESPONSIBLE_ID` (en `src/config/env.ts`) vale `6`
(VAZQUEZ HEREDIA BRAYAN ULISES). Si se crea una actividad sin `responsibleId`
ni `responsibleName`, queda asignada a esa persona, no al usuario autenticado.
Pasar siempre `responsibleId` explícito al crear actividades para otra persona
(o para uno mismo, si el usuario autenticado no coincide con el default).

Caso real: una actividad se creó sin `responsibleId` y quedó asignada a Brayan;
se corrigió eliminando (`track_delete_activity`) y recreando con
`responsibleId` explícito — porque `track_update_activity` no garantiza poder
reasignar/corregir ciertos campos de forma confiable en todas las instalaciones.

## 5. Catálogo de tipos: "Desing" (typo oficial)

`FALLBACK_ACTIVITY_TYPES` en `src/config/constants.ts` incluye el literal
`'Desing'` con el comentario "Ortografía oficial del backend". Pasar `type:
"Design"` en modo real es rechazado ("Tipo de actividad inválido: 'Design'.
Verifica el catálogo de tipos."), aunque el dry-run lo acepta sin validar contra
catálogo real. Usar siempre `"Desing"` para la categoría de diseño.

## 6. Servicio/producto inconsistente

Si se pasa `productId` de un servicio distinto al que se resuelve dinámicamente
a partir de `type`/`projectId`, la API rechaza con: "El producto X pertenece al
servicio Y, no al servicio Z". Solución: pasar `serviceId` explícito que
coincida con el servicio real del producto (consultable vía
`track_get_catalogs`).

## 7. `type` no es editable de forma confiable después de creación

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

## 8. `track_get_my_activities`: sin filtro de rango de fechas

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
