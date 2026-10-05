# Guía de Conexión e Integración con VS Code: Servidor MCP Activity Tracking

Esta guía explica paso a paso cómo conectar este servidor MCP a tu entorno de desarrollo en VS Code (Cline, Roo Code, GitHub Copilot o Claude Desktop).

---

## 1. Requisitos Previos

1. **Compilación del Servidor:**
   Asegúrate de que la carpeta `dist/` esté generada ejecutando:
   ```bash
   cd "C:\Users\Ulises\Downloads\utils vs code\ActivityTracking\MCP_ActivityTracking"
   npm run build
   ```
2. **Ubicación del Ejecutable:**
   El archivo principal compilado es:
   `C:\Users\Ulises\Downloads\utils vs code\ActivityTracking\MCP_ActivityTracking\dist\index.js`
3. **Credenciales en `.env`:**
   Edita el archivo `.env` en esa misma carpeta y coloca tu contraseña real en `AUTH_PASSWORD`.

---

## 2. Conexión con Cline (Extensión de VS Code)

1. En VS Code, abre la pestaña de **Cline**.
2. Haz clic en el ícono de engranaje (**Settings**) o ícono de **MCP Servers**.
3. Haz clic en **"Edit MCP Settings"** (abrirá `cline_mcp_settings.json`).
4. Agrega o combina la siguiente configuración:

```json
{
  "mcpServers": {
    "activity-tracking": {
      "command": "node",
      "args": [
        "C:\\Ruta\\A\\Tu\\MCP_ActivityTracking\\dist\\index.js"
      ],
      "env": {
        "API_BASE_URL": "http://10.200.1.13:5100",
        "AUTH_USERNAME": "usuario.companero",
        "AUTH_PASSWORD": "TU_PASSWORD_AQUI",
        "DRY_RUN_MODE": "true"
      }
    }
  }
}
```

> **✨ ¡Configuración Mínima (Zero-Config)!**  
> El servidor MCP deduce **automáticamente** al iniciar sesión:
> - El **ID del Responsable**
> - El **Nombre Completo del Usuario**
> - El **Servicio Predeterminado** asignado al usuario
> 
> *No es necesario ingresar manualmente IDs de responsable o servicio.*


5. Guarda el archivo. Cline detectará y activará automáticamente las 12 herramientas (indicador en verde).

---

## 3. Conexión con Roo Code (Extensión de VS Code)

1. En VS Code, abre la pestaña de **Roo Code**.
2. Abre la configuración de MCP (**MCP Servers** en el panel superior).
3. Haz clic en **"Edit MCP Settings"** (abrirá `roo_code_mcp_settings.json`).
4. Pega la configuración equivalente (disponible en [`roo_code_mcp_settings.json`](./roo_code_mcp_settings.json)).
5. Guarda el archivo y reinicia el servidor desde la interfaz de Roo Code si es necesario.

---

## 4. Pruebas y Prompts Recomendados en el Chat

Una vez conectado, puedes interactuar en lenguaje natural con tu asistente:

### A. Consultas de Lectura Segura (Zero Impact):

$\rightarrow$ El asistente activará `track_get_sprint_work_items(sprintId: 1176)`.
$\rightarrow$ El asistente activará `track_get_my_activities(responsibleId: 6, status: "InProgress")`.
$\rightarrow$ El asistente activará `track_get_metrics_and_balance(period: "current_week")`.
$\rightarrow$ El asistente activará `track_get_meetings()`.

### B. Pruebas de Registro con Modo Dry-Run (Simulación Segura):

- _"Registra que hoy trabajé 3.5 horas en el desarrollo de la vista de usuarios para Comunidad Informática y déjala en progreso al 60%."_
  $\rightarrow$ El asistente activará `track_create_activity`.
  -> Al estar activo `DRY_RUN_MODE=true`, el servidor validará esquemas, inferirá `projectId: 11` (CI) y `serviceId: 4` (Cooperación en TIC). Para una escritura real también debe incluirse un `productId` compatible; así se habilita el seguimiento por etapas.

---

## 5. Hoja de Ruta para Operación de Escritura Real (Futuro)

Cuando el flujo esté 100% probado y decidas habilitar la escritura directa en producción:

1. En `.env` o en la configuración del cliente MCP, cambia:
   ```bash
   DRY_RUN_MODE=false
   ```
2. Para actividades experimentales, podrás pasar opcionalmente `isProposal: true` para que se registren como propuestas o borradores aislados de las métricas principales.
