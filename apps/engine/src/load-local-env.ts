import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseEnvFile(content: string) {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  parseEnvFile(fs.readFileSync(filePath, 'utf8'));
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '..', '..', '..');

const candidates = [
  path.resolve(workspaceRoot, '.env'),
  path.resolve(workspaceRoot, '.env.local'),
  path.resolve(workspaceRoot, 'infra/n8n/.env')
];

for (const filePath of candidates) {
  loadIfExists(filePath);
}
