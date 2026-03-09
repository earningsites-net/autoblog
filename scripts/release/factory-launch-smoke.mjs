#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      out._.push(token);
      continue;
    }

    const eqIdx = token.indexOf('=');
    if (eqIdx !== -1) {
      const key = token.slice(2, eqIdx);
      out[key] = token.slice(eqIdx + 1);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
      continue;
    }
    out[key] = true;
  }
  return out;
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseEnvFile(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = rawLine.indexOf('=');
    if (idx === -1) continue;
    const key = rawLine.slice(0, idx).trim();
    let value = rawLine.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function isConfigured(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (normalized.toLowerCase().startsWith('replace-')) return false;
  return true;
}

async function request(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      text,
      json
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: String((error && error.message) || error),
      json: null
    };
  }
}

function logResult(label, result) {
  const prefix = result.ok ? '[PASS]' : '[FAIL]';
  console.log(`${prefix} ${label} -> status=${result.status}`);
  if (!result.ok && result.text) {
    console.log(`       ${result.text.slice(0, 320)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(currentDir, '..', '..');
  const envPath = path.resolve(workspaceRoot, String(args['root-env'] || '.env'));
  const envFromFile = fs.existsSync(envPath) ? parseEnvFile(envPath) : {};

  const siteSlug = String(args.site || 'lux-living-01').trim();
  const baseUrl = String(
    args['base-url'] || envFromFile.CONTENT_ENGINE_URL || envFromFile.PORTAL_BASE_URL || 'http://localhost:8787'
  ).replace(/\/$/, '');
  const factorySecret = String(args['factory-secret'] || envFromFile.FACTORY_API_SECRET || '').trim();
  const execute = parseBool(args.execute);
  const applySanity = parseBool(args['apply-sanity']);
  const runPrepopulate = parseBool(args['run-prepopulate']);
  const force = parseBool(args.force);
  const topicCount = Math.max(1, Number(args['topic-count'] || 60));

  if (!isConfigured(factorySecret)) {
    console.error('Missing factory secret. Provide --factory-secret or configure FACTORY_API_SECRET in root env.');
    process.exit(1);
  }

  console.log('Factory launch smoke');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Site: ${siteSlug}`);
  console.log(`Mode: ${execute ? 'execute launch' : 'preflight only'}`);
  console.log('');

  const health = await request(`${baseUrl}/healthz`, { method: 'GET' });
  logResult('GET /healthz', health);

  const headers = {
    'x-factory-secret': factorySecret
  };

  const options = await request(`${baseUrl}/api/factory/options`, {
    method: 'GET',
    headers
  });
  logResult('GET /api/factory/options', options);

  const status = await request(`${baseUrl}/api/factory/site/${encodeURIComponent(siteSlug)}/status`, {
    method: 'GET',
    headers
  });
  logResult('GET /api/factory/site/:siteSlug/status', status);

  let launch = { ok: true, status: 204, text: '', json: null };
  if (execute) {
    const body = {
      siteSlug,
      applySanity,
      runPrepopulate,
      force,
      topicCount,
      topicStatus: 'brief_ready',
      topicSource: 'suggest',
      replaceTopics: true
    };

    launch = await request(`${baseUrl}/api/factory/site/launch`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    logResult('POST /api/factory/site/launch', launch);
  } else {
    console.log('[PASS] launch skipped -> use --execute to run POST /api/factory/site/launch');
  }

  console.log('');
  if (execute && launch.ok && launch.json) {
    console.log('Launch response preview:');
    console.log(JSON.stringify(launch.json, null, 2).slice(0, 1200));
  }

  const failed = [health, options, status, launch].filter((item) => !item.ok);
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
