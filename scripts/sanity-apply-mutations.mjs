#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function usage() {
  console.log(`
Usage:
  node scripts/sanity-apply-mutations.mjs --file <mutations.json> [--dry-run]

Examples:
  node scripts/sanity-apply-mutations.mjs --file sites/hammer-hearth/seed-content/topic-candidates.mutations.json
  node scripts/sanity-apply-mutations.mjs --file sites/hammer-hearth/seed-content/sanity.mutations.json
`);
}

function parseArgs(argv) {
  const out = { file: '', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (token === '--file') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out.file = next;
        i += 1;
      }
      continue;
    }
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    }
  }
  return out;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  usage();
  process.exit(1);
}

const root = process.cwd();
const env = {
  ...parseEnvFile(path.join(root, 'infra', 'n8n', '.env')),
  ...parseEnvFile(path.join(root, '.env')),
  ...process.env
};

const projectId = env.SANITY_PROJECT_ID;
const dataset = env.SANITY_DATASET || 'production';
const apiVersion = env.SANITY_API_VERSION || '2025-01-01';
const writeToken = env.SANITY_WRITE_TOKEN;

if (!projectId || !writeToken) {
  console.error('Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN (infra/n8n/.env or process env).');
  process.exit(1);
}

const filePath = path.resolve(root, args.file);
if (!fs.existsSync(filePath)) {
  console.error(`Mutations file not found: ${filePath}`);
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (error) {
  console.error(`Invalid JSON file: ${filePath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!payload || typeof payload !== 'object' || !Array.isArray(payload.mutations)) {
  console.error('Input file must contain: { "mutations": [...] }');
  process.exit(1);
}

if (payload.mutations.length === 0) {
  console.log('No mutations to apply.');
  process.exit(0);
}

if (args.dryRun) {
  console.log(`Dry run: ${payload.mutations.length} mutation(s) ready from ${path.relative(root, filePath)}`);
  process.exit(0);
}

const url = `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`;
const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${writeToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  const text = await response.text();
  console.error(`Sanity mutate failed (${response.status}): ${text}`);
  if (response.status === 401 && (/SIO-401-ANF/i.test(text) || /Session not found/i.test(text))) {
    console.error('');
    console.error('Auth hint: SANITY_WRITE_TOKEN is invalid/revoked or from a different Sanity project.');
    console.error('1) Create a new API token (role: Editor or equivalent write access) in this exact project.');
    console.error(`2) Project expected by this script: ${projectId} (dataset: ${dataset})`);
    console.error('3) Update infra/n8n/.env -> SANITY_WRITE_TOKEN, then rerun the command.');
  }
  process.exit(1);
}

const result = await response.json();
const transactionId = result?.transactionId || 'n/a';
console.log(`Applied ${payload.mutations.length} mutation(s). Transaction: ${transactionId}`);
