# Guía de Conexión e Integración con VS Code: Servidor MCP Activity Tracking

Esta guía explica paso a paso cómo conectar este servidor MCP a tu entorno de desarrollo en VS Code (Cline, Roo Code o GitHub Copilot) utilizando la arquitectura **Centralizada en Podman (SSE Multi-Usuario)** o mediante ejecución local por **Stdio**.

---

## 🚀 Método Recomendado: Conexión al Servidor Central Podman (SSE)

Con este método **NO necesitas instalar Node.js, compilar código, clonar repositorios ni configurar archivos `.env` locales**. El servidor central atiende peticiones en tiempo real aislando las credenciales y sesiones de cada desarrollador.

### 1. Configuración en Cline (`cline_mcp_settings.json`)

1. En VS Code, abre el panel de **Cline**.
2. Haz clic en el ícono de engranaje (**Settings**) $\rightarrow$ **MCP Servers**.
3. Haz clic en **Edit MCP Settings**.
4. Agrega o sustituye la configuración:

```json
{
  "mcpServers": {
    "activity-tracking": {
      "type": "sse",
      "url": "http://10.185.1.2:3333/sse",
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

### 2. Configuración en Roo Code (`roo_code_mcp_settings.json`)

1. En VS Code, abre la pestaña de **Roo Code**.
2. Ve a la sección **MCP Servers**.
3. Haz clic en **Edit MCP Settings** y añade:

```json
{
  "mcpServers": {
    "activity-tracking": {
      "type": "sse",
      "url": "http://10.185.1.2:3333/sse",
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

> **🔐 Seguridad y Aislamiento Dinámico:**  
> Las cabeceras `X-Auth-Username` y `X-Auth-Password` viajan protegidas en cada petición de tu VS Code. El servidor central adquiere un token JWT exclusivo para tu usuario en memoria volátil y ejecuta las consultas y registros en la API estrictamente a tu nombre.

---

## 🛠️ Método Alternativo: Ejecución Local Offline (`stdio`)

Si trabajas en modo desarrollo sobre el código fuente del MCP o fuera de la red del contenedor:

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
         "args": ["d:\\TRABAJO\\MCP_ActivityTracking\\dist\\index.js", "--stdio"],
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

## 💬 Pruebas y Ejemplos de Prompts en el Chat

Una vez conectado, tu asistente IA reconocerá las herramientas automáticamente:

### Consultas de Lectura (Inmediatas y Seguras):
- _"¿Qué tareas tengo asignadas en mis actividades activas?"_  
  $\rightarrow$ Invoca `track_get_my_activities`.
- _"Muestra el resumen de work items del Sprint 1176."_  
  $\rightarrow$ Invoca `track_get_sprint_work_items`.
- _"¿Cuántas horas llevo reportadas esta semana y cuánto me falta de mi capacidad?"_  
  $\rightarrow$ Invoca `track_get_metrics_and_balance`.

### Registro Asistido por Lenguaje Natural (Modo Dry-Run):
- _"Registra que hoy trabajé 3 horas en la revisión técnica para Comunidad Informática."_  
  $\rightarrow$ Invoca `track_create_activity`. Con `DRY_RUN_MODE=true` activo, validará el formato institucional sin insertar datos en producción.
