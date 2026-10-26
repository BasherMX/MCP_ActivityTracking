# Guía de Instalación del MCP Activity Tracking

Guía oficial para conectar y utilizar el servidor MCP (**Model Context Protocol**) del Sistema Institucional de Seguimiento de Actividades tanto en **Visual Studio Code** como en **Claude Desktop**.

---

## 1. Instalación en Visual Studio Code

VS Code cuenta con soporte nativo para servidores MCP a través de su configuración de herramientas de IA (por ejemplo, con **GitHub Copilot Chat**).

### A. Si tienes abierto este repositorio/proyecto en VS Code

El proyecto ya incluye el archivo preconfigurado [`.vscode/mcp.json`](file:///c:/Users/Ulises/Downloads/utils%20vs%20code/ActivityTracking/MCP_ActivityTracking/.vscode/mcp.json):

1. **Abre la paleta de comandos**: presiona `Ctrl + Shift + P` (o `Cmd + Shift + P` en macOS).
2. Escribe y selecciona: `MCP: List Servers`.
3. Selecciona el servidor **`sistema-seguimiento`** y pulsa **Start** (Iniciar) si aparece detenido.
4. VS Code te solicitará de forma segura en pantalla:
   - **Usuario institucional** (ej. `tu.usuario`).
   - **Contraseña institucional** (campo protegido).
5. Abre **GitHub Copilot Chat** y en el selector de herramientas (ícono de herramientas/martillo) confirma que `sistema-seguimiento` esté habilitado.

---

### B. Configuración global en VS Code (para usarlo en cualquier proyecto o ventana)

Si deseas tener disponible el servidor en cualquier ventana de VS Code sin necesidad de estar dentro de esta carpeta:

1. Abre la paleta de comandos (`Ctrl + Shift + P`).
2. Ejecuta: `MCP: Open User Configuration` (o edita el archivo de configuración global de MCP en VS Code).
3. Añade la configuración en el bloque de `servers` e `inputs`:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "activity-tracking-username",
      "description": "Usuario institucional"
    },
    {
      "type": "promptString",
      "id": "activity-tracking-password",
      "description": "Contraseña institucional",
      "password": true
    }
  ],
  "servers": {
    "sistema-seguimiento": {
      "type": "sse",
      "url": "http://172.20.117.246:3333/sse",
      "headers": {
        "X-Auth-Username": "${input:activity-tracking-username}",
        "X-Auth-Password": "${input:activity-tracking-password}"
      }
    }
  }
}
```

> **Nota de Seguridad**: Nunca guardes contraseñas en texto plano dentro del archivo JSON. El uso de `${input:...}` asegura que VS Code te pida la contraseña en cada sesión manteniéndola protegida en memoria.

---

### C. Comprobación de conectividad del servidor

Para confirmar que el servicio central está activo, abre en el navegador o ejecuta en PowerShell:

```powershell
Invoke-RestMethod -Uri 'http://172.20.117.246:3333/health'
```

Debe retornar un JSON con `"status": "ok"`.

---

## 2. Instalación en Claude Desktop (mediante paquete `.mcpb`)

Claude Desktop permite instalar servidores MCP completos empaquetados en un único archivo autocontenido **MCPB (Model Context Protocol Bundle)** con tan solo arrastrar y soltar.

### Enlace de descarga oficial
Descarga la última versión del paquete `.mcpb` desde GitHub Releases:
👉 **[Descargar activity-tracking.mcpb](https://github.com/BasherMX/MCP_ActivityTracking/releases/download/mcpb-latest/activity-tracking.mcpb)**

---

### Pasos para instalar en Claude Desktop:

1. **Descarga el archivo**: haz clic en el enlace superior para descargar `activity-tracking.mcpb`.
2. **Abre Claude Desktop**.
3. Dirígete a **Settings** (Configuración) $\rightarrow$ pestaña **Extensions** (Extensiones).
4. **Arrastra y suelta** el archivo `activity-tracking.mcpb` descargado directamente sobre la ventana de Claude Desktop (o en la zona designada para extensiones).
5. Se abrirá la ventana de configuración del paquete donde debes ingresar tus credenciales:
   - **Usuario Institucional:** Tu nombre de usuario de red (ej. `adrian.garcia` o `brayan.vazquez`).
   - **Contraseña Institucional:** Tu contraseña de red institucional.
   - **URL API Activity Tracking:** Preconfigurada por defecto en `http://10.200.1.13:5100`.
   - **Modo Dry-Run:** `false` (o `true` si prefieres pruebas de simulación sin inserción en base de datos).
6. Haz clic en **Instalar / Guardar**.

¡Listo! En la ventana de chat de Claude Desktop aparecerá el ícono de martillo 🔨 con las 23 herramientas listas para ser utilizadas.

---

## 3. Ejemplos de uso para probar las herramientas

Una vez conectado tanto en VS Code como en Claude Desktop, puedes interactuar en lenguaje natural:

- *"¿Qué tareas y actividades tengo asignadas actualmente?"* $\rightarrow$ Invoca `track_get_my_activities`.
- *"Consulta el estado de los work items del Sprint 1176."* $\rightarrow$ Invoca `track_get_sprint_work_items`.
- *"¿Cuántas horas llevo reportadas esta semana y cuál es mi balance?"* $\rightarrow$ Invoca `track_get_metrics_and_balance`.
- *"Registra 3 horas trabajadas hoy en la revisión técnica de Comunidad Informática."* $\rightarrow$ Invoca `track_create_activity`.
