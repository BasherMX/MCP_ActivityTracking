# Servidor MCP: Activity Tracking API (Node.js & TypeScript)

Servidor oficial compatible con el **Model Context Protocol (MCP)** para integrar asistentes de inteligencia artificial en VS Code (Cline, Roo Code, GitHub Copilot) con el sistema institucional **Activity Tracking API** de ASP.NET Core Kestrel (`http://10.200.1.13:5100`).

---

## Características Principales

1. **Protocolo Estándar MCP:** Comunicación local de alto rendimiento mediante transporte `stdio` (JSON-RPC 2.0).
2. **Cero Polución en Producción:**
   - **Prioridad de Solo Lectura:** Endpoints `GET` para Work Items de Sprints, Actividades, Reuniones y Métricas.
   - **Modo Dry-Run Obligatorio:** Todas las mutaciones (`POST`, `PUT`, `PATCH`) se interceptan y simulan localmente con validación estricta de esquemas Zod.
3. **Red HTTP Directa (`http://10.200.1.13:5100`):**
   - Sin problemas de certificados TLS/SSL auto-firmados en Node.js.
   - Acceso simultáneo a Swagger UI en `http://10.200.1.13:5100/swagger/index.html`.
4. **Motor de Inferencia Semántica:** Traduce texto libre ("arreglé bug en CI por 3 horas") a identificadores exactos del sistema (`projectId: 11`, `serviceId: 5`, `type: "Maintenance"`, `hours: 3`).
5. **Autenticación JWT en Memoria:** Login transparente contra `/api/v1/Responsibles/authenticate` con auto-refresh.

## Configuración de Compatibilidad

Para el responsable predeterminado `6` (Brayan) y el proyecto `11` (Comunidad Informática), el servicio predeterminado debe ser `4` (Cooperación en TIC). El servicio `5` (Soporte a Ing. de Software) no es válido para esa combinación y la API responde `400 Bad Request`.

El valor se mantiene alineado en `DEFAULT_SERVICE_ID`, en el resolvedor NLP y en los ejemplos de configuración. Si se indica un `serviceId` explícito, debe verificarse que corresponda al responsable asignado antes de escribir en producción.

Las actividades nuevas también deben incluir `productId`. Sin un producto, el sistema no puede crear el seguimiento por etapas y la pantalla de proceso muestra que la actividad no tiene producto asignado. El MCP valida que el producto exista y pertenezca al servicio seleccionado antes de una escritura real.

## Incidente Documentado: Creación de Actividad de Prueba

El 5 de octubre de 2026 se intentó registrar una actividad de prueba para Brayan con proyecto CI y servicio `5`. La API rechazó el `POST /api/v1/Activities` con `400 Bad Request` y el mensaje: `El responsable seleccionado no pertenece al servicio indicado en la actividad.`

La actividad no se creó en ese intento. Se corrigió el servicio a `4`, la API respondió `201 Created` y la actividad quedó registrada como `CI102` (ID `10779`) en estado `InProgress`. La consulta posterior confirmó que persistió correctamente.

La prevención aplicada consiste en usar el servicio `4` como valor por defecto para el responsable `6` y en mantener esa relación documentada en la configuración y el resolvedor de texto.

## Incidente Documentado: Producto Faltante, Fechas y Etapas de Proceso en CI102

Al abrir la actividad `CI102` (ID `10779`), la API indicaba que no tenía producto ni etapas asignadas.
1. **Asignación de Producto y Fechas:** Se asignó el producto `37` (`Documentación de Artefactos Técnicos`), compatible con el servicio `4` (Cooperación en TIC), y se registraron las fechas de inicio y entrega (`estimatedStartDate`, `actualStartDate`, `estimatedDeliveryDate`, `actualCompletionDate`) con fecha del 5 de octubre de 2026.
2. **Seguimiento y Avanzado por Etapas de Proceso:**
   - **Etapa 38 (*Diseño de la documentación*):** Se avanzó a la etapa 38 mediante `POST /api/v1/process-stages/activity/10779/advance` (Progress ID `1339`).
   - **Registro de Horas:** Se capturó 1 hora laborada sobre la etapa `1339` vía `POST /api/v1/stage-work-entries/by-progress/1339`, completando al 100% la 1 hora es    - **Etapa 39 (*Revisión*):** Se avanzó a la etapa 39 (Progress ID `1340`).
    - **Etapa 40 (*Publicación - Cierre*):** Se avanzó a la etapa 40 final (Progress ID `1341`), concluyendo el ciclo completo del producto.
3. **Eliminación y Limpieza Final:** Tras completar la verificación y demostración del flujo en producción, se ejecutó la eliminación permanente mediante `DELETE /api/v1/Activities/10779` (`track_delete_activity`), confirmando su remoción total de la base de datos (la API retornó `204 No Content` seguido de `404 Not Found`).

---

## Catálogo de Herramientas MCP Disponibles (23 Tools)

### Operaciones 100% de Lectura Segura (Zero-Impact):

| Tool                            | Descripción                                                       | Endpoint Backend                                      |
| :------------------------------ | :---------------------------------------------------------------- | :---------------------------------------------------- |
| `track_get_sprint_work_items`   | Consulta tareas, historias y bugs de un Sprint (ej. Sprint 1176). | `GET /api/v1/Sprints/{id}/work-items`                 |
| `track_get_my_activities`       | Consulta actividades asignadas a Brayan (`responsibleId: 6`).     | `GET /api/v1/Activities/by-responsible/{id}`          |
| `track_get_activity_detail`     | Consulta avance y detalle completo de una actividad por ID.       | `GET /api/v1/Activities/{id}`                         |
| `track_get_process_stages`      | Consulta las etapas de proceso de un producto o el historial.     | `GET /api/v1/process-stages/...`                      |
| `track_get_observations`        | Consulta las notas y observaciones registradas en una actividad.  | `GET /api/v1/activities/{id}/Observations`            |
| `track_get_metrics_and_balance` | Calcula horas acumuladas vs. capacidad semanal/mensual.           | `GET /api/v1/stage-work-entries/hours-by-responsible` |
| `track_get_meetings`            | Consulta reuniones registradas en Teams/sistema.                  | `GET /api/v1/Meetings`                                |
| `track_get_incidencias`         | Consulta asuetos, vacaciones, permisos y permisos del personal.   | `GET /api/v1/Incidencias`                             |
| `track_get_catalogs`            | Consulta catálogo de Proyectos, Servicios, Productos y Sprints.   | `GET /api/v1/Projects`, `/Services`, `/Products`      |

### Operaciones de Mutación Protegidas por Dry-Run:

| Tool                           | Descripción                                     | Endpoint Backend Simulado                          |
| :----------------------------- | :---------------------------------------------- | :------------------------------------------------- |
| `track_create_activity`        | Registro de nueva actividad con resolución NLP. | `POST /api/v1/Activities`                          |
| `track_update_activity`        | Actualización de avance, fechas, producto y estado. | `PUT /api/v1/Activities/{id}`                 |
| `track_create_meeting`         | Registra una reunión con asistentes y tipo de sesión. | `POST /api/v1/Meetings`                      |
| `track_update_meeting`         | Actualiza estado, notas o detalles de reunión.  | `PUT /api/v1/Meetings/{id}`                        |
| `track_create_incidencia`      | Registra asueto, vacaciones, permiso o ausencia. | `POST /api/v1/Incidencias`                        |
| `track_delete_incidencia`      | Elimina una incidencia por su ID.               | `DELETE /api/v1/Incidencias/{id}`                  |
| `track_advance_process_stage`  | Avanza la actividad a una nueva etapa de proceso. | `POST /api/v1/process-stages/activity/{id}/advance` |
| `track_add_observation`        | Agrega una nota de tipo General, Blocker, Agreement, Risk, etc. | `POST /api/v1/activities/{id}/Observations` |
| `track_close_activity`         | Conclusión al 100% en estado `Completed`.       | `PUT /api/v1/Activities/{id}`                      |
| `track_delete_activity`        | Elimina permanentemente una actividad por su ID. | `DELETE /api/v1/Activities/{id}`                  |
| `track_log_work_hours`         | Captura de horas de trabajo por etapa.          | `POST /api/v1/stage-work-entries/by-progress/{id}` |
| `track_upload_evidence_file`   | Carga de archivo binario local (captura, PDF).  | `POST /api/v1/activities/{id}/evidence/file`       |
| `track_attach_evidence_url`    | Vinculación de URL de GitLab/documentación.     | `POST /api/v1/activities/{id}/evidence/url`        |
| `track_sync_sprints`           | Sincroniza tableros de Azure DevOps con Sprints. | `POST /api/v1/Sprints/sync/{projectId}`           |

---

## Estructura del Proyecto

```text
MCP_ActivityTracking/
├── package.json               # Dependencias y scripts npm
├── tsconfig.json              # Configuración TypeScript NodeNext
├── .env                       # Variables de entorno locales
├── .env.example               # Plantilla de configuración
├── cline_mcp_settings.json    # Configuración lista para Cline
├── roo_code_mcp_settings.json # Configuración lista para Roo Code
├── VSCODE_SETUP.md            # Guía detallada de integración con VS Code
│
├── dist/                      # Código JavaScript compilado
│   └── index.js               # Entrypoint ejecutable para MCP Stdio
│
├── src/
│   ├── index.ts               # Servidor MCP Stdio y dispatcher
│   ├── config/                # Variables de entorno y catálogos
│   ├── types/                 # Interfaces DTOs de OpenAPI
│   ├── services/              # Wrappers de API REST y Auth Manager
│   ├── tools/                 # Esquemas Zod y controladores de las 12 tools
│   └── utils/                 # Inferencia NLP y logger seguro a stderr
│
└── test/
    ├── test-dry-run.ts        # Suite de pruebas de validación y simulación
    └── test-stdio-mcp.ts      # Test end-to-end simulando cliente JSON-RPC
```

---

## Comandos y Scripts

```bash
# Compilar TypeScript a JavaScript (dist/)
npm run build

# Compilar en modo observación continua
npm run watch

# Ejecutar pruebas locales de simulación Dry-Run
npm run test:dryrun

# Ejecutar prueba de integración Stdio JSON-RPC
npx tsx test/test-stdio-mcp.ts
```

---

## Guía de Conexión en VS Code

Consulta el archivo [VSCODE_SETUP.md](./VSCODE_SETUP.md) para instrucciones detalladas paso a paso sobre cómo vincular este servidor a Cline o Roo Code.
