import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shellEnvKeys = new Set(Object.keys(process.env));

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
    // Preserve values explicitly provided by the shell, but allow later files
    // in our local-env chain to override earlier ones.
    if (shellEnvKeys.has(key)) continue;
    process.env[key] = value;
  }
}

function loadIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  parseEnvFile(fs.readFileSync(filePath, 'utf8'));
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '..', '..');

const candidates = [
  path.resolve(currentDir, '.env'),
  path.resolve(currentDir, '.env.local'),
  path.resolve(workspaceRoot, '.env'),
  path.resolve(workspaceRoot, '.env.local')
];

for (const filePath of [...new Set(candidates)]) {
  loadIfExists(filePath);
}
