#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const out = { limit: 20, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') out.dryRun = true;
    if (token === '--limit') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out.limit = Math.max(1, Number(next) || 20);
        i += 1;
      }
    }
  }
  return out;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const env = {};
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

const { limit, dryRun } = parseArgs(process.argv.slice(2));
const root = process.cwd();
const envPath = path.join(root, 'infra', 'n8n', '.env');
const env = { ...parseEnvFile(envPath), ...process.env };

const projectId = env.SANITY_PROJECT_ID;
const dataset = env.SANITY_DATASET || 'production';
const apiVersion = env.SANITY_API_VERSION || '2025-01-01';
const writeToken = env.SANITY_WRITE_TOKEN;
const readToken = env.SANITY_READ_TOKEN;

if (!projectId || !writeToken) {
  console.error('Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN.');
  process.exit(1);
}

const query = `*[_type=="article" && status=="ready_to_publish"]|order(qaPassedAt asc)[0...${limit}]{_id,slug,title,status,pipelineMode}`;
const queryUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
const queryRes = await fetch(queryUrl, {
  headers: {
    Authorization: `Bearer ${readToken || writeToken}`
  }
});

if (!queryRes.ok) {
  const text = await queryRes.text();
  console.error(`Failed to query ready_to_publish articles (${queryRes.status}): ${text}`);
  process.exit(1);
}

const queryJson = await queryRes.json();
const docs = Array.isArray(queryJson.result) ? queryJson.result : [];

if (!docs.length) {
  console.log('No ready_to_publish articles found.');
  process.exit(0);
}

if (dryRun) {
  console.log(`Dry run: found ${docs.length} ready_to_publish article(s).`);
  for (const doc of docs) {
    const slug = doc?.slug?.current || '';
    console.log(`- ${doc._id} :: ${slug || doc.title || 'no-slug'}`);
  }
  process.exit(0);
}

const nowIso = new Date().toISOString();
const mutations = docs.map((doc) => ({
  patch: {
    id: doc._id,
    set: {
      status: 'published',
      publishedAt: nowIso,
      publishScheduledAt: nowIso,
      pipelineMode: doc.pipelineMode || 'steady_scheduled'
    }
  }
}));

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
  console.error(`Failed to publish ready_to_publish articles (${mutateRes.status}): ${text}`);
  process.exit(1);
}

console.log(`Published ${docs.length} article(s) from ready_to_publish.`);
