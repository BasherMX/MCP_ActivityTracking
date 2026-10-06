# Guía de instalación del MCP Activity Tracking en VS Code

Esta guía conecta VS Code, GitHub Copilot Chat, Cline o Roo Code al servidor MCP del Sistema de Seguimiento.

---

## Conexión desde VS Code y GitHub Copilot

El servidor está disponible en `http://172.20.117.246:3333`. La dirección `/health` permite comprobar disponibilidad; VS Code debe conectarse a `/sse`.

1. Abre esta carpeta del proyecto en VS Code. Ya incluye `.vscode/mcp.json` con la conexión lista.
2. Abre la paleta de comandos con `Ctrl+Shift+P` y ejecuta `MCP: List Servers`.
3. Selecciona `sistema-seguimiento` y pulsa **Start** si aparece detenido. VS Code solicitará el usuario y la contraseña institucional.
4. Abre GitHub Copilot Chat y utiliza el selector de herramientas para habilitar las herramientas de `sistema-seguimiento`.

Para configurar MCP en otro workspace, ejecuta `MCP: Open User Configuration` desde la paleta de comandos y copia la sección `inputs` y el servidor `sistema-seguimiento` desde `.vscode/mcp.json`.

No guardes la contraseña directamente en el JSON ni compartas una configuración que la contenga. Esta conexión utiliza HTTP sin TLS: úsala únicamente en una red de confianza. Para exponerla fuera de esa red, coloca el servicio detrás de un proxy HTTPS.

### Comprobación de conexión

Abre `http://172.20.117.246:3333/health` en el navegador. Debe responder JSON con `"status":"ok"`. También puedes verificarlo desde PowerShell:

```powershell
Invoke-RestMethod -Uri 'http://172.20.117.246:3333/health'
```

La IP pertenece a la interfaz de red de la máquina virtual de Podman y puede cambiar al reiniciarla. Si cambia, actualiza la URL de `.vscode/mcp.json` y reinicia el servidor MCP desde `MCP: List Servers`.

## Cline: conexión SSE

En VS Code, abre **Cline → Settings → MCP Servers → Edit MCP Settings** y agrega la configuración al objeto `mcpServers`:

```json
{
  "mcpServers": {
    "activity-tracking": {
      "type": "sse",
      "url": "http://172.20.117.246:3333/sse",
      "headers": {
        "X-Auth-Username": "tu.usuario",
        "X-Auth-Password": "TuPasswordInstitucional"
      },
      "disabled": false,
      "autoApprove": [
        "track_get_sprint_work_items",
        "track_get_my_activities",
        "track_get_activity_detail",
        "track_get_metrics_and_balance",
        "track_get_meetings",
        "track_get_catalogs"
      ]
    }
  }
}
```

## Roo Code: conexión SSE

Abre **Roo Code → MCP Servers → Edit MCP Settings** y agrega la configuración al objeto `mcpServers`:

```json
{
  "mcpServers": {
    "activity-tracking": {
      "type": "sse",
      "url": "http://172.20.117.246:3333/sse",
      "headers": {
        "X-Auth-Username": "tu.usuario",
        "X-Auth-Password": "TuPasswordInstitucional"
      },
      "alwaysAllow": [
        "track_get_sprint_work_items",
        "track_get_my_activities",
        "track_get_activity_detail",
        "track_get_metrics_and_balance",
        "track_get_meetings",
        "track_get_catalogs"
      ]
    }
  }
}
```

El cliente envía las cabeceras `X-Auth-Username` y `X-Auth-Password` al servidor MCP para autenticar las solicitudes en la API.

## Ejecución local alternativa (`stdio`)

Si desarrollas este repositorio o no tienes acceso a la red del contenedor:

1. Compila el proyecto:
   ```bash
   npm run build
   ```
2. Configura tu cliente MCP con transporte `command`:
   ```json
   {
     "mcpServers": {
       "activity-tracking-local": {
         "command": "node",
         "args": [
           "d:\\TRABAJO\\MCP_ActivityTracking\\dist\\index.js",
           "--stdio"
         ],
         "env": {
           "API_BASE_URL": "http://10.200.1.13:5100",
           "AUTH_USERNAME": "tu.usuario",
           "AUTH_PASSWORD": "TuPasswordAqui",
           "DRY_RUN_MODE": "true"
         }
       }
     }
   }
   ```

---

## Ejemplos para probar las herramientas

Una vez conectado, tu asistente IA reconocerá las herramientas automáticamente:

### Consultas de lectura

- _"¿Qué tareas tengo asignadas en mis actividades activas?"_  
  $\rightarrow$ Invoca `track_get_my_activities`.
- _"Muestra el resumen de work items del Sprint 1176."_  
  $\rightarrow$ Invoca `track_get_sprint_work_items`.
- _"¿Cuántas horas llevo reportadas esta semana y cuánto me falta de mi capacidad?"_  
  $\rightarrow$ Invoca `track_get_metrics_and_balance`.

### Registro en modo Dry-Run

- _"Registra que hoy trabajé 3 horas en la revisión técnica para Comunidad Informática."_  
  $\rightarrow$ Invoca `track_create_activity`. Con `DRY_RUN_MODE=true` activo, validará el formato institucional sin insertar datos en producción.
