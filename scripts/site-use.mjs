#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_ENV_PATH = path.join(WORKSPACE_ROOT, '.env');

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};
  const positional = [];

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = args[0] && !args[0].startsWith('--') ? args.shift() : 'true';
      flags[key] = value;
      continue;
    }
    positional.push(token);
  }

  return { positional, flags };
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    env[key] = value;
  }
  return env;
}

function upsertEnvFile(filePath, updates) {
  const exists = fs.existsSync(filePath);
  const originalLines = exists ? fs.readFileSync(filePath, 'utf8').split(/\r?\n/) : [];
  const nextLines = [];
  const replaced = new Set();
  const keys = new Set(Object.keys(updates));

  for (const line of originalLines) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) {
      nextLines.push(line);
      continue;
    }

    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    if (!keys.has(key)) {
      nextLines.push(line);
      continue;
    }

    if (!replaced.has(key)) {
      nextLines.push(`${key}=${updates[key] ?? ''}`);
      replaced.add(key);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!replaced.has(key)) {
      nextLines.push(`${key}=${value ?? ''}`);
    }
  }

  const normalized = `${nextLines.filter((line, i, arr) => !(line === '' && i === arr.length - 1)).join('\n')}\n`;
  fs.writeFileSync(filePath, normalized, 'utf8');
}

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`Missing ${name}`);
  return normalized;
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const siteSlug = String(positional[0] || '').trim().toLowerCase();
  if (!siteSlug) {
    throw new Error('Usage: node scripts/site-use.mjs <site-slug> [--root-env .env]');
  }

  const siteDir = path.join(WORKSPACE_ROOT, 'sites', siteSlug);
  const generatedEnvPath = path.join(siteDir, '.env.generated');
  if (!fs.existsSync(generatedEnvPath)) {
    throw new Error(`Missing site env file: ${generatedEnvPath}`);
  }

  const siteEnv = parseEnvFile(generatedEnvPath);
  const projectId = required(siteEnv.SANITY_PROJECT_ID, 'SANITY_PROJECT_ID in .env.generated');
  const dataset = required(siteEnv.SANITY_DATASET || 'production', 'SANITY_DATASET in .env.generated');
  const apiVersion = required(siteEnv.SANITY_API_VERSION || '2025-01-01', 'SANITY_API_VERSION in .env.generated');
  const readToken = required(siteEnv.SANITY_READ_TOKEN, 'SANITY_READ_TOKEN in .env.generated');
  const writeToken = required(siteEnv.SANITY_WRITE_TOKEN, 'SANITY_WRITE_TOKEN in .env.generated');

  const rootEnvPath = path.resolve(WORKSPACE_ROOT, String(flags['root-env'] || '.env'));
  const updates = {
    SITE_BLUEPRINT_PATH: `./sites/${siteSlug}/site.blueprint.json`,
    SITE_SLUG: siteSlug,
    SANITY_STUDIO_SITE_SLUG: siteSlug,
    NEXT_PUBLIC_SITE_SLUG: siteSlug,
    SANITY_PROJECT_ID: projectId,
    SANITY_DATASET: dataset,
    SANITY_API_VERSION: apiVersion,
    SANITY_READ_TOKEN: readToken,
    SANITY_WRITE_TOKEN: writeToken,
    SANITY_STUDIO_PROJECT_ID: projectId,
    SANITY_STUDIO_DATASET: dataset
  };

  upsertEnvFile(rootEnvPath, updates);

  const masked = (token) => (token.length <= 10 ? '***' : `${token.slice(0, 4)}...${token.slice(-4)}`);
  const output = {
    ok: true,
    siteSlug,
    updatedEnv: path.relative(WORKSPACE_ROOT, rootEnvPath) || '.env',
    sanity: {
      projectId,
      dataset,
      apiVersion,
      readToken: masked(readToken),
      writeToken: masked(writeToken)
    },
    nextStep: 'Run `npm run dev:down && npm run dev:up`'
  };

  console.log(JSON.stringify(output, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
