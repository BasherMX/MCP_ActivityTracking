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
