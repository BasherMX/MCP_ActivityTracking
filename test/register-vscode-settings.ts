import fs from 'node:fs';

const settingsPath = 'C:/Users/Ulises/AppData/Roaming/Code/User/settings.json';
let content = fs.readFileSync(settingsPath, 'utf8');

if (!content.includes('"activity-tracking"')) {
  const target = '"github.copilot.chat.mcpServers": {';
  const insertion = `"github.copilot.chat.mcpServers": {
    "activity-tracking": {
      "command": "node",
      "args": [
        "C:\\\\Users\\\\Ulises\\\\Downloads\\\\utils vs code\\\\ActivityTracking\\\\MCP_ActivityTracking\\\\dist\\\\index.js"
      ],
      "env": {
        "API_BASE_URL": "http://10.200.1.13:5100",
        "DRY_RUN_MODE": "true"
      }
    },`;

  if (content.includes(target)) {
    content = content.replace(target, insertion);
    fs.writeFileSync(settingsPath, content, 'utf8');
    console.log('✅ Servidor activity-tracking agregado exitosamente a github.copilot.chat.mcpServers en settings.json');
  } else {
    console.error('❌ Target no encontrado');
  }
} else {
  console.log('ℹ️ activity-tracking ya estaba presente en settings.json');
}
