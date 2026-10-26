# Incidentes Documentados y Bitácora de Pruebas

Este documento registra los incidentes, validaciones y pruebas de integración históricas realizadas sobre la API de **Activity Tracking**.

---

## Incidente Documentado: Creación de Actividad de Prueba

El 5 de octubre de 2026 se intentó registrar una actividad de prueba para el usuario con proyecto CI y servicio `5`. La API rechazó el `POST /api/v1/Activities` con `400 Bad Request` y el mensaje: `El responsable seleccionado no pertenece al servicio indicado en la actividad.`

La actividad no se creó en ese intento. Se corrigió el servicio a `4`, la API respondió `201 Created` y la actividad quedó registrada como `CI102` (ID `10779`) en estado `InProgress`. La consulta posterior confirmó que persistió correctamente.

La prevención aplicada consiste en usar el servicio `4` como valor por defecto para el responsable asignado y en mantener esa relación documentada en la configuración y el resolvedor de texto.

---

## Incidente Documentado: Producto Faltante, Fechas y Etapas de Proceso en CI102

Al abrir la actividad `CI102` (ID `10779`), la API indicaba que no tenía producto ni etapas asignadas.

1. **Asignación de Producto y Fechas:** Se asignó el producto `37` (`Documentación de Artefactos Técnicos`), compatible con el servicio `4` (Cooperación en TIC), y se registraron las fechas de inicio y entrega (`estimatedStartDate`, `actualStartDate`, `estimatedDeliveryDate`, `actualCompletionDate`) con fecha del 5 de octubre de 2026.
2. **Seguimiento y Avanzado por Etapas de Proceso:**
   - **Etapa 38 (*Diseño de la documentación*):** Se avanzó a la etapa 38 mediante `POST /api/v1/process-stages/activity/10779/advance` (Progress ID `1339`).
   - **Registro de Horas:** Se capturó 1 hora laborada sobre la etapa `1339` vía `POST /api/v1/stage-work-entries/by-progress/1339`, completando al 100% la 1 hora estimada.
   - **Etapa 39 (*Revisión*):** Se avanzó a la etapa 39 (Progress ID `1340`).
   - **Etapa 40 (*Publicación - Cierre*):** Se avanzó a la etapa 40 final (Progress ID `1341`), concluyendo el ciclo completo del producto.
3. **Eliminación y Limpieza Final:** Tras completar la verificación y demostración del flujo en producción, se ejecutó la eliminación permanente mediante `DELETE /api/v1/Activities/10779` (`track_delete_activity`), confirmando su remoción total de la base de datos (la API retornó `204 No Content` seguido de `404 Not Found`).

----
## Limitaciones del MCP de Actividades: Acciones Solicitadas (ESTADO: ATENDIDAS)

Durante la creación de CI115, CI116 y CI117 y de las reuniones asociadas, se solicitaron acciones que originalmente no podían completarse. Todas han sido resueltas y atendidas en el servidor MCP:

1. **Agregar colaboradora a las etapas de CI115: [ATENDIDO]**
   - **Solución implementada:** Se crearon las tools oficiales `track_add_stage_collaborator` (`POST /api/v1/process-stages/progress/{progressId}/collaborators`) y `track_remove_stage_collaborator`. Ahora es posible asignar o desvincular formalmente a colaboradores como `MARIA ISABEL CORDERO ZUÑIGA` (ID `31`) en cualquier etapa del proceso.
2. **Registrar el correo como observación en CI117: [ATENDIDO]**
   - **Solución implementada:** Se corrigió `track_add_observation` inyectando automáticamente el campo obligatorio `createdBy` derivado de la sesión activa (`authManager.getResponsibleName()`). Ya no retorna error 400 y permite almacenar el texto completo de correos y acuerdos institucionales.
3. **Corregir la etapa de cierre de CI112: [ATENDIDO]**
   - **Solución implementada:** Se integró la directiva estricta de validación y avance secuencial de etapas, impidiendo cierres desfasados y permitiendo avanzar etapas específicas mediante `track_advance_process_stage`.
4. **Modificar la descripción de la reunión 6256: [ATENDIDO]**
   - **Solución implementada:** Se actualizó `track_update_meeting` garantizando el mapeo y envío del campo `description` hacia el endpoint `PUT /api/v1/Meetings/{id}`.
5. **Fechas de inicio y entrega al crear actividades: [ATENDIDO]**
   - **Solución implementada:** `track_create_activity` ahora acepta y serializa directamente `estimatedStartDate` y `estimatedDeliveryDate` desde el momento de la creación de la actividad, eliminando la necesidad de invocar un update posterior.

----

## Incidente Documentado: Registro Incompleto de Etapas y Alcance de Gestión en Actividad de Alerta PHP2Shell (ESTADO: ATENDIDO)

En el canal de la Comunidad Informática se observó que la actividad de publicación de la alerta informativa "PHP2Shell: vulnerabilidades críticas en PHP que podrían comprometer servidores y aplicaciones web" fue registrada con una descripción de gestión y difusión que no correspondía al alcance real del trabajo. Además, la actividad fue ejecutada sin seguir las etapas del proceso configuradas.

1. **Descripción de la actividad y alcance declarado:** Se actualizó `src/utils/nlp-resolver.ts` para respetar la descripción y no anteponer forzosamente verbos redundantes como "Desarrollar" ni truncar títulos destructivamente con `...`.
2. **Etapas del proceso omitidas y Ponderación de Horas: [ATENDIDO]**
   - El conector MCP ahora reconoce el flujo secuencial de etapas de cada producto y exige no omitir etapas.
   - **Distribución Ponderada de Tiempos:** Se formalizó la regla operativa donde etapas pasivas/recepción reciben `0.0 hrs`, la etapa de desarrollo/ejecución recibe el `80% - 90%` del tiempo, y el cierre/evidencias el remanente `10% - 20%`.
3. **Contenido del registro de avance: [ATENDIDO]**
   - El MCP ahora exige al usuario qué trabajo realizó específicamente en la etapa antes de ejecutar el avance, mejorando la redacción a un lenguaje técnico formal para guardarlo en las notas de la etapa.
4. **Colaboraciones Totales y Parciales: [ATENDIDO]**
   - **Apoyo Total en Etapa:** Mediante `track_add_stage_collaborator` (`POST /api/v1/process-stages/progress/{progressId}/collaborators`) y `track_remove_stage_collaborator`.
   - **Apoyo Parcial:** Mediante `track_log_work_hours` sobre el `stageProgressId` con `isSupport: true` (ej. 15 minutos de apoyo del Usuario B mientras Usuario A conserva su tiempo de trabajo principal).

----

## Resumen Diario y Balance de Capacidad en Horas (ESTADO: ATENDIDO)
- **Problema previo:** El resumen solo consideraba horas directas de actividades sin sumar etapas ni reuniones.
- **Solución implementada:**
  - Nueva tool **`track_get_daily_report`** (`GET /api/v1/Reports/daily`): consolida actividades, etapas y reuniones por persona, calculando horas reales por día y detectando personas con captura pendiente (`missingCapture`).
  - Nueva tool **`track_get_capacity_workload`** (`GET /api/v1/Reports/capacity-workload`): evalúa la capacidad esperada semanal/mensual (ej. 40 hrs semanales) y verifica automáticamente que el cumplimiento supere el umbral mínimo esperado (> 60%).

----

## Sincronización de Work Items y Sprints (ESTADO: ATENDIDO)
- **Problema previo:** Confusión entre sincronizar todos los sprints de un proyecto vs. sincronizar el contenido interno de un sprint.
- **Solución implementada:**
  - `track_sync_sprints`: Reservado explícitamente para sincronizar los sprints a nivel de proyecto (`POST /api/v1/Sprints/sync/{projectId}`).
  - Nueva tool **`track_sync_sprint_work_items`** (`POST /api/v1/Sprints/{sprintId}/work-items/sync`): Sincroniza selectivamente los work items internos de un sprint específico.