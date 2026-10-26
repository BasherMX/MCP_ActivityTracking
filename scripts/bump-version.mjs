import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = join(projectRoot, "package.json");
const packageLockPath = join(projectRoot, "package-lock.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const currentVersion = packageJson.version || "1.0.0";

// Extraer versión limpia ignorando sufijos pre-release o build
const cleanVersion = currentVersion.split(/[-+]/)[0];
const parts = cleanVersion.split(".").map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);

const [major, minor, patch] = parts;
const nextVersion = `${major}.${minor}.${patch + 1}`;

packageJson.version = nextVersion;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

if (existsSync(packageLockPath)) {
  try {
    const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
    packageLock.version = nextVersion;
    if (packageLock.packages && packageLock.packages[""]) {
      packageLock.packages[""].version = nextVersion;
    }
    writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
  } catch (err) {
    console.warn("No se pudo actualizar package-lock.json:", err.message);
  }
}

console.log(`[Version Bump] ${currentVersion} -> ${nextVersion}`);
