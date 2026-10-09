import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const buildDirectory = join(projectRoot, ".mcpb-build");
const outputFile = join(projectRoot, "activity-tracking.mcpb");
const version = process.env.MCPB_VERSION || packageJson.version;

rmSync(buildDirectory, { recursive: true, force: true });
rmSync(outputFile, { force: true });
mkdirSync(buildDirectory, { recursive: true });

const distDirectory = join(projectRoot, "dist");
const nodeModulesDirectory = join(projectRoot, "node_modules");
if (!existsSync(distDirectory) || !existsSync(nodeModulesDirectory)) {
  throw new Error("dist/ y node_modules/ deben existir. Ejecuta npm ci y npm run build primero.");
}

cpSync(distDirectory, join(buildDirectory, "dist"), { recursive: true });
cpSync(nodeModulesDirectory, join(buildDirectory, "node_modules"), { recursive: true });
writeFileSync(
  join(buildDirectory, "package.json"),
  `${JSON.stringify({ name: packageJson.name, version, type: packageJson.type }, null, 2)}\n`,
);

const toolsModule = await import(pathToFileURL(join(distDirectory, "tools", "index.js")).href);
const tools = toolsModule.getToolDefinitions().map(({ name, description }) => ({ name, description }));

const manifest = {
  manifest_version: "0.2",
  name: "activity-tracking-mcp",
  display_name: "Activity Tracking MCP",
  version,
  description: "MCP extension for the institutional Activity Tracking API.",
  author: { name: "DCMTIC" },
  server: {
    type: "node",
    entry_point: "dist/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/dist/index.js", "--stdio"],
      env: {
        API_BASE_URL: "${user_config.api_base_url}",
        AUTH_USERNAME: "${user_config.username}",
        AUTH_PASSWORD: "${user_config.password}",
        DRY_RUN_MODE: "${user_config.dry_run_mode}",
      },
    },
  },
  user_config: {
    username: {
      type: "string",
      title: "Institutional Username",
      description: "Network username used to authenticate against the API.",
      required: true,
    },
    password: {
      type: "string",
      title: "Institutional Password",
      description: "Network password used to authenticate against the API.",
      required: true,
      sensitive: true,
    },
    api_base_url: {
      type: "string",
      title: "Activity Tracking API URL",
      description: "Base URL of the REST API.",
      required: false,
      default: "http://10.200.1.13:5100",
    },
    dry_run_mode: {
      type: "boolean",
      title: "Dry-Run Mode",
      description: "Simulate write operations without changing production data.",
      required: false,
      default: false,
    },
  },
  tools,
  license: packageJson.license || "ISC",
};

writeFileSync(join(buildDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

if (process.platform === "win32") {
  execFileSync("tar", ["-a", "-cf", outputFile, "-C", buildDirectory, "manifest.json", "package.json", "dist", "node_modules"], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-qr", outputFile, "manifest.json", "package.json", "dist", "node_modules"], {
    cwd: buildDirectory,
    stdio: "inherit",
  });
}

rmSync(buildDirectory, { recursive: true, force: true });
console.log(`MCPB generado: ${outputFile}`);
console.log(`Version: ${version}`);
console.log(`Herramientas incluidas: ${tools.length}`);
