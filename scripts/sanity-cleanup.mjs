#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const out = {
    dryRun: false,
    includeTopics: false,
    allSiteContent: false,
    chunkSize: 200,
    siteSlug: ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (token === '--include-topics') {
      out.includeTopics = true;
      continue;
    }
    if (token === '--all-site-content') {
      out.allSiteContent = true;
      continue;
    }
    if (token === '--chunk-size') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out.chunkSize = Math.max(1, Number(next) || 200);
        i += 1;
      }
      continue;
    }
    if (token === '--site-slug') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out.siteSlug = String(next).trim();
        i += 1;
      }
      continue;
    }
    if (token === '--help' || token === '-h') {
      console.log(`
Usage:
  node scripts/sanity-cleanup.mjs [--dry-run] [--include-topics] [--all-site-content] [--chunk-size 200] [--site-slug hammer-hearth]

Default deletes:
  - article
  - qaLog
  - generationRun

Optional:
  --include-topics  Also delete topicCandidate docs.
  --all-site-content Delete all documents filtered by siteSlug (all _type values with siteSlug).
  --site-slug       Restrict cleanup to documents with this siteSlug (default: env SITE_SLUG if set).
`);
      process.exit(0);
    }

    console.error(`Unknown argument: ${token}`);
    process.exit(1);
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

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const args = parseArgs(process.argv.slice(2));
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
const readToken = env.SANITY_READ_TOKEN || writeToken;

if (!projectId || !writeToken) {
  console.error('Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN (infra/n8n/.env or process env).');
  process.exit(1);
}

const targetTypes = ['article', 'qaLog', 'generationRun'];
if (args.includeTopics) targetTypes.push('topicCandidate');

const queryBase = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`;
const mutateUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`;
const headersRead = { Authorization: `Bearer ${readToken}` };
const headersWrite = { Authorization: `Bearer ${writeToken}`, 'Content-Type': 'application/json' };

const effectiveSiteSlug = args.siteSlug || env.SITE_SLUG || '';

async function fetchIdsByType(typeName) {
  const all = [];
  let start = 0;
  const pageSize = 1000;

  while (true) {
    const siteFilter = effectiveSiteSlug ? ` && siteSlug=="${effectiveSiteSlug.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : '';
    const groq = `*[_type=="${typeName}"${siteFilter}][${start}...${start + pageSize}]{_id}`;
    const url = `${queryBase}?query=${encodeURIComponent(groq)}`;
    const res = await fetch(url, { headers: headersRead });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Query failed for type "${typeName}" (${res.status}): ${text}`);
    }
    const json = await res.json();
    const page = Array.isArray(json.result) ? json.result : [];
    all.push(...page.map((doc) => doc?._id).filter(Boolean));
    if (page.length < pageSize) break;
    start += pageSize;
  }

  return all;
}

async function fetchSiteDocsBySlug(siteSlug) {
  const all = [];
  let start = 0;
  const pageSize = 1000;
  const escapedSiteSlug = String(siteSlug).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  while (true) {
    const groq = `*[_type != "sanity.imageAsset" && _type != "sanity.fileAsset" && siteSlug=="${escapedSiteSlug}"][${start}...${start + pageSize}]{_id,_type}`;
    const url = `${queryBase}?query=${encodeURIComponent(groq)}`;
    const res = await fetch(url, { headers: headersRead });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Query failed for all-site-content (${res.status}): ${text}`);
    }
    const json = await res.json();
    const page = Array.isArray(json.result) ? json.result : [];
    all.push(...page.filter((doc) => doc?._id && doc?._type));
    if (page.length < pageSize) break;
    start += pageSize;
  }

  return all;
}

if (args.allSiteContent && !effectiveSiteSlug) {
  console.error('Missing --site-slug (or SITE_SLUG env) with --all-site-content for safety.');
  process.exit(1);
}

const idsByType = {};
let allDeleteIds = [];

if (args.allSiteContent) {
  const docs = await fetchSiteDocsBySlug(effectiveSiteSlug);
  for (const doc of docs) {
    if (!idsByType[doc._type]) idsByType[doc._type] = [];
    idsByType[doc._type].push(doc._id);
  }
  allDeleteIds = docs.map((doc) => doc._id);
} else {
  for (const typeName of targetTypes) {
    idsByType[typeName] = await fetchIdsByType(typeName);
  }
  allDeleteIds = targetTypes.flatMap((typeName) => idsByType[typeName]);
}

// Deduplicate defensivey in case of overlapping sources.
allDeleteIds = [...new Set(allDeleteIds)];
const reportTypes = Object.keys(idsByType).sort();

console.log('Sanity cleanup plan:');
if (effectiveSiteSlug) {
  console.log(`- siteSlug filter: ${effectiveSiteSlug}`);
}
if (args.allSiteContent) {
  console.log('- mode: all-site-content');
}
for (const typeName of reportTypes) {
  console.log(`- ${typeName}: ${idsByType[typeName].length}`);
}
console.log(`Total docs to delete: ${allDeleteIds.length}`);

if (args.dryRun || allDeleteIds.length === 0) {
  if (args.dryRun) console.log('Dry run only. No mutations applied.');
  process.exit(0);
}

const chunks = chunkArray(allDeleteIds, args.chunkSize);
let deleted = 0;

for (const ids of chunks) {
  const payload = {
    mutations: ids.map((id) => ({ delete: { id } }))
  };
  const res = await fetch(mutateUrl, {
    method: 'POST',
    headers: headersWrite,
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete batch failed (${res.status}): ${text}`);
  }
  deleted += ids.length;
  console.log(`Deleted ${deleted}/${allDeleteIds.length}`);
}

console.log('Cleanup completed.');
