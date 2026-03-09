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

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assertAllowed(value, allowed, label) {
  if (!value) return null;
  if (!allowed.includes(value)) {
    throw new Error(`Invalid ${label}: "${value}". Allowed: ${allowed.join(', ')}`);
  }
  return value;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteSlug = normalizeSlug(args.site);
  if (!siteSlug) {
    console.error('Missing --site <site-slug>');
    process.exit(1);
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(currentDir, '..', '..');
  const registryPath = path.resolve(workspaceRoot, String(args.registry || 'sites/registry.json'));

  if (!fs.existsSync(registryPath)) {
    console.error(`Registry not found: ${registryPath}`);
    process.exit(1);
  }

  const domainStatus = assertAllowed(
    args['domain-status'] ? String(args['domain-status']).trim() : null,
    ['pending', 'active', 'transferred'],
    'domain-status'
  );
  const automationStatus = assertAllowed(
    args['automation-status'] ? String(args['automation-status']).trim() : null,
    ['inactive', 'active', 'paused'],
    'automation-status'
  );
  const mode = assertAllowed(
    args.mode ? String(args.mode).trim() : null,
    ['transfer', 'managed'],
    'mode'
  );
  const ownerType = assertAllowed(
    args['owner-type'] ? String(args['owner-type']).trim() : null,
    ['internal', 'client'],
    'owner-type'
  );
  const billingStatus = assertAllowed(
    args['billing-status'] ? String(args['billing-status']).trim() : null,
    ['n/a', 'trial', 'active', 'overdue', 'canceled'],
    'billing-status'
  );
  const webBaseUrl = args['web-base-url'] ? String(args['web-base-url']).trim() : null;

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  if (!Array.isArray(registry?.sites)) {
    console.error(`Invalid registry format: ${registryPath}`);
    process.exit(1);
  }

  const index = registry.sites.findIndex((entry) => normalizeSlug(entry.siteSlug) === siteSlug);
  if (index === -1) {
    console.error(`Site not found in registry: ${siteSlug}`);
    process.exit(1);
  }

  const current = registry.sites[index];
  const next = {
    ...current,
    ...(domainStatus ? { domainStatus } : {}),
    ...(automationStatus ? { automationStatus } : {}),
    ...(mode ? { mode } : {}),
    ...(ownerType ? { ownerType } : {}),
    ...(billingStatus ? { billingStatus } : {}),
    ...(webBaseUrl ? { webBaseUrl } : {}),
    updatedAt: new Date().toISOString()
  };

  registry.sites[index] = next;
  registry.updatedAt = new Date().toISOString();

  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

  console.log('Updated registry entry');
  console.log(`siteSlug=${siteSlug}`);
  console.log(
    JSON.stringify(
      {
        before: {
          domainStatus: current.domainStatus,
          automationStatus: current.automationStatus,
          mode: current.mode,
          ownerType: current.ownerType,
          billingStatus: current.billingStatus,
          webBaseUrl: current.webBaseUrl
        },
        after: {
          domainStatus: next.domainStatus,
          automationStatus: next.automationStatus,
          mode: next.mode,
          ownerType: next.ownerType,
          billingStatus: next.billingStatus,
          webBaseUrl: next.webBaseUrl
        }
      },
      null,
      2
    )
  );
}

main();
