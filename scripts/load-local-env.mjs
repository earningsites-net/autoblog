import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseEnvFile(content) {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadIfExists(filePath) {
  if (!fs.existsSync(filePath)) return;
  parseEnvFile(fs.readFileSync(filePath, 'utf8'));
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '..');

for (const filePath of [
  path.join(workspaceRoot, '.env'),
  path.join(workspaceRoot, '.env.local'),
  path.join(workspaceRoot, 'infra', 'n8n', '.env')
]) {
  loadIfExists(filePath);
}
