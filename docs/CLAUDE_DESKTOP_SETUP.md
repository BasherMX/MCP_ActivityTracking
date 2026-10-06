# Guía de Conexión de Claude Desktop con el Servidor MCP Activity Tracking

Esta guía explica detalladamente cómo instalar y conectar el servidor MCP institucional **Activity Tracking** en **Claude Desktop** en Windows y macOS.

---

## ⚡ Método 1: Instalación con 1 Clic (Arrastrar Archivo `.mcpb` o `.dxt`) — ¡EL MÁS FÁCIL!

Claude Desktop soporta paquetes autocontenidos **MCPB (Model Context Protocol Bundle)**. Hemos generado los paquetes listos para instalar:

* 📦 **[`activity-tracking.mcpb`](../activity-tracking.mcpb)** (Formato estándar oficial)
* 📦 **[`activity-tracking.dxt`](../activity-tracking.dxt)** (Formato heredado DXT)

### Pasos para instalar:

1. **Abre Claude Desktop**.
2. Ve a **Settings** (Configuración) $\rightarrow$ pestaña **Extensions** (Extensiones).
3. **Arrastra y suelta** el archivo [`activity-tracking.mcpb`](../activity-tracking.mcpb) directamente sobre la ventana de Claude Desktop (o en la zona donde indica *"Arrastra archivos .MCPB o .DXT aquí para instalar"*).
4. Claude Desktop mostrará un asistente para configurar tus credenciales:
   * **Usuario Institucional:** Ingresa tu usuario (ej. `brayan.vazquez` o `adrian.garcia`).
   * **Contraseña Institucional:** Ingresa tu contraseña de red (campo protegido/oculto).
   * **URL API Activity Tracking:** Ya viene preconfigurado con `http://10.200.1.13:5100`.
   * **Modo Dry-Run:** `false` (o `true` para simulación).
5. Haz clic en **Instalar / Guardar**. ¡Listo! Las 23 herramientas quedarán vinculadas de inmediato sin necesidad de editar archivos JSON a mano.

---

## 🌐 Método 2: Conexión al Servidor Central Podman (SSE Bridge)

Si prefieres conectar Claude Desktop al servidor institucional centralizado (`http://10.185.1.67:3333/sse`) a través de un puente de red:

Edita tu archivo de configuración `claude_desktop_config.json`:
* **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
* **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "activity-tracking": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "http://10.185.1.67:3333/sse",
        "--header",
        "X-Auth-Username: tu.usuario",
        "--header",
        "X-Auth-Password: TuPasswordInstitucional"
      ]
    }
  }
}
```

---

## 🛠️ Método 3: Configuración Manual Directa (`stdio`)

Para desarrolladores con el proyecto clonado en su disco local:

```json
{
  "mcpServers": {
    "activity-tracking": {
      "command": "node",
      "args": [
        "D:\\TRABAJO\\MCP_ActivityTracking\\dist\\index.js",
        "--stdio"
      ],
      "env": {
        "API_BASE_URL": "http://10.200.1.13:5100",
        "AUTH_USERNAME": "tu.usuario",
        "AUTH_PASSWORD": "TuPasswordInstitucional",
        "DRY_RUN_MODE": "false"
      }
    }
  }
}
```

---

## ✅ Verificación en el Chat

1. Al abrir o reiniciar Claude Desktop, observa el cuadro de entrada de mensajes.
2. En la esquina inferior derecha verás el ícono de **herramientas / martillo** 🔨.
3. Al hacer clic se mostrarán las **23 herramientas oficiales activas**:
   * `track_get_my_activities`
   * `track_create_activity`
   * `track_update_activity`
   * `track_close_activity`
   * `track_get_sprint_work_items`
   * `track_get_metrics_and_balance`
   * `track_get_catalogs`
   * `track_log_work_hours`, etc.
