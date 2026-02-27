#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
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
    out[key] = value;
  }
  return out;
}

function randomKey() {
  return Math.random().toString(36).slice(2, 10);
}

const root = process.cwd();
const envFile = path.join(root, 'infra', 'n8n', '.env');
const env = {
  ...parseEnvFile(envFile),
  ...process.env
};

const projectId = env.SANITY_PROJECT_ID;
const dataset = env.SANITY_DATASET || 'production';
const apiVersion = env.SANITY_API_VERSION || '2025-01-01';
const writeToken = env.SANITY_WRITE_TOKEN;

if (!projectId || !writeToken) {
  console.error('Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN. Set them in infra/n8n/.env or process env.');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');

const query = '*[_type=="article" && defined(faqItems) && count(faqItems) > 0]{_id, faqItems}';
const queryUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}`;

const readRes = await fetch(queryUrl, {
  headers: {
    Authorization: `Bearer ${writeToken}`
  }
});

if (!readRes.ok) {
  const text = await readRes.text();
  console.error(`Failed to query articles (${readRes.status}): ${text}`);
  process.exit(1);
}

const payload = await readRes.json();
const docs = Array.isArray(payload.result) ? payload.result : [];

const mutations = [];
let touchedItems = 0;

for (const doc of docs) {
  const faqItems = Array.isArray(doc.faqItems) ? doc.faqItems : [];
  let changed = false;

  const normalized = faqItems.map((item) => {
    const next = { ...(item || {}) };
    if (!next._type) {
      next._type = 'faqItem';
      changed = true;
    }
    if (!next._key) {
      next._key = randomKey();
      changed = true;
    }
    return next;
  });

  if (changed) {
    touchedItems += 1;
    mutations.push({
      patch: {
        id: doc._id,
        set: {
          faqItems: normalized
        }
      }
    });
  }
}

if (!mutations.length) {
  console.log('No faqItems to fix. All articles already have _key/_type.');
  process.exit(0);
}

if (dryRun) {
  console.log(`Dry run: would patch ${mutations.length} article(s).`);
  process.exit(0);
}

const mutateUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`;
const mutateRes = await fetch(mutateUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${writeToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ mutations })
});

if (!mutateRes.ok) {
  const text = await mutateRes.text();
  console.error(`Failed to patch faqItems (${mutateRes.status}): ${text}`);
  process.exit(1);
}

console.log(`Patched faqItems in ${touchedItems} article(s).`);
