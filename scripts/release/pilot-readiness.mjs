#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveRuntimePaths,
  resolveSiteBlueprintPath,
  resolveSiteRuntimeEnvPath
} from '../lib/runtime-paths.mjs';

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

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
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

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function isConfigured(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (lower.startsWith('replace-') || lower.startsWith('replace_with')) return false;
  if (lower.includes('<workflow-id>')) return false;
  if (lower === 'changeme123!') return false;
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = String(args.stage || 'staging').toLowerCase();
  if (stage !== 'staging' && stage !== 'production') {
    console.error('Invalid --stage value. Use "staging" or "production".');
    process.exit(1);
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(currentDir, '..', '..');
  const runtimePaths = resolveRuntimePaths({ workspaceRoot, env: process.env });
  const siteSlug = normalizeSlug(String(args.site || 'lux-living-01'));
  const rootEnvPath = path.resolve(workspaceRoot, String(args['root-env'] || '.env'));
  const n8nEnvPath = path.resolve(workspaceRoot, String(args['n8n-env'] || 'infra/n8n/.env'));
  const registryPath = path.resolve(workspaceRoot, String(args.registry || runtimePaths.registryPath));
  const blueprintPath = resolveSiteBlueprintPath(workspaceRoot, siteSlug);
  const siteEnvPath = resolveSiteRuntimeEnvPath(runtimePaths, siteSlug);

  const checks = [];
  const pushCheck = (id, ok, detail, severity = 'error') => {
    checks.push({ id, ok: Boolean(ok), detail, severity });
  };

  pushCheck('file.root_env', fs.existsSync(rootEnvPath), rootEnvPath);
  pushCheck('file.n8n_env', fs.existsSync(n8nEnvPath), n8nEnvPath);
  pushCheck('file.blueprint', fs.existsSync(blueprintPath), blueprintPath);
  pushCheck('file.registry', fs.existsSync(registryPath), registryPath);
  pushCheck('file.site_env_generated', fs.existsSync(siteEnvPath), siteEnvPath);

  if (!fs.existsSync(rootEnvPath) || !fs.existsSync(n8nEnvPath) || !fs.existsSync(blueprintPath) || !fs.existsSync(registryPath)) {
    printSummary(stage, siteSlug, checks);
    process.exit(1);
  }

  const rootEnv = parseEnvFile(rootEnvPath);
  const n8nEnv = parseEnvFile(n8nEnvPath);
  const blueprint = readJsonFile(blueprintPath);
  const registry = readJsonFile(registryPath);
  const siteEnv = fs.existsSync(siteEnvPath) ? parseEnvFile(siteEnvPath) : {};

  const n8nDefaultSiteSlug = normalizeSlug(n8nEnv.SITE_SLUG);
  pushCheck(
    'site_slug.n8n_default_optional',
    !n8nDefaultSiteSlug || n8nDefaultSiteSlug === siteSlug,
    `n8n.SITE_SLUG=${n8nDefaultSiteSlug || '(empty)'} expected=${siteSlug} (optional, used only by scheduled trigger default)`,
    'warn'
  );

  pushCheck(
    'blueprint.deployment_target',
    String(blueprint?.deploymentTarget?.kind || '') === 'vercel',
    `deploymentTarget.kind=${String(blueprint?.deploymentTarget?.kind || '(missing)')}`,
    'error'
  );
  pushCheck(
    'blueprint.publishing_target',
    String(blueprint?.publishingTarget?.kind || '') === 'sanity',
    `publishingTarget.kind=${String(blueprint?.publishingTarget?.kind || '(missing)')}`,
    'error'
  );

  const registrySites = Array.isArray(registry?.sites) ? registry.sites : [];
  const registryEntry = registrySites.find((entry) => normalizeSlug(entry.siteSlug) === siteSlug) || null;
  pushCheck('registry.site_entry', Boolean(registryEntry), `site=${siteSlug}`, 'error');
  if (registryEntry) {
    pushCheck(
      'registry.domain_status',
      ['pending', 'active', 'transferred'].includes(String(registryEntry.domainStatus || '')),
      `domainStatus=${String(registryEntry.domainStatus || '(missing)')}`,
      'error'
    );
    pushCheck(
      'registry.automation_status',
      ['inactive', 'active', 'paused'].includes(String(registryEntry.automationStatus || '')),
      `automationStatus=${String(registryEntry.automationStatus || '(missing)')}`,
      'error'
    );
    if (stage === 'production') {
      pushCheck(
        'registry.production_domain_active',
        String(registryEntry.domainStatus || '') === 'active',
        `domainStatus=${String(registryEntry.domainStatus || '(missing)')}`,
        'warn'
      );
      pushCheck(
        'registry.production_automation_active',
        String(registryEntry.automationStatus || '') === 'active',
        `automationStatus=${String(registryEntry.automationStatus || '(missing)')}`,
        'warn'
      );
    }
  }

  const requiredRootKeys = [
    'INTERNAL_API_TOKEN',
    'FACTORY_API_SECRET',
    'FACTORY_UI_USERNAME',
    'PREPOPULATE_TRIGGER_URL'
  ];
  for (const key of requiredRootKeys) {
    pushCheck(
      `root.${key}`,
      isConfigured(rootEnv[key]),
      `${key}=${isConfigured(rootEnv[key]) ? '(set)' : '(missing/placeholder)'}`,
      'error'
    );
  }
  pushCheck(
    'root.FACTORY_UI_PASSWORD_or_fallback',
    isConfigured(rootEnv.FACTORY_UI_PASSWORD) || isConfigured(rootEnv.FACTORY_API_SECRET),
    'FACTORY_UI_PASSWORD or FACTORY_API_SECRET fallback required',
    'error'
  );
  pushCheck(
    'root.PREPOPULATE_TRIGGER_URL_pattern',
    String(rootEnv.PREPOPULATE_TRIGGER_URL || '').includes('factory-prepopulate'),
    'PREPOPULATE_TRIGGER_URL should target factory-prepopulate webhook',
    'error'
  );

  const requiredN8nKeys = [
    'INTERNAL_API_TOKEN',
    'WEB_REVALIDATE_SECRET',
    'CONTENT_ENGINE_URL',
    'WEB_APP_URL',
    'N8N_HOST',
    'N8N_PROTOCOL',
    'N8N_ENCRYPTION_KEY',
    'N8N_BASIC_AUTH_USER',
    'N8N_BASIC_AUTH_PASSWORD',
    'POSTGRES_PASSWORD'
  ];
  for (const key of requiredN8nKeys) {
    pushCheck(
      `n8n.${key}`,
      isConfigured(n8nEnv[key]),
      `${key}=${isConfigured(n8nEnv[key]) ? '(set)' : '(missing/placeholder)'}`,
      'error'
    );
  }

  const tokensAligned =
    isConfigured(rootEnv.INTERNAL_API_TOKEN) &&
    isConfigured(n8nEnv.INTERNAL_API_TOKEN) &&
    rootEnv.INTERNAL_API_TOKEN === n8nEnv.INTERNAL_API_TOKEN;
  pushCheck(
    'alignment.INTERNAL_API_TOKEN',
    tokensAligned,
    'root INTERNAL_API_TOKEN must match n8n INTERNAL_API_TOKEN',
    'error'
  );

  if (stage === 'production') {
    const requiredStripeKeys = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_ID_BASE',
      'STRIPE_PRICE_ID_STANDARD',
      'STRIPE_PRICE_ID_PRO'
    ];
    for (const key of requiredStripeKeys) {
      pushCheck(
        `root.${key}`,
        isConfigured(rootEnv[key]),
        `${key}=${isConfigured(rootEnv[key]) ? '(set)' : '(missing/placeholder)'}`,
        'error'
      );
    }
  }

  pushCheck(
    'site_env.CONTENT_REPOSITORY_DRIVER',
    ['sanity', 'api', 'auto'].includes(String(siteEnv.CONTENT_REPOSITORY_DRIVER || '').toLowerCase()),
    `CONTENT_REPOSITORY_DRIVER=${String(siteEnv.CONTENT_REPOSITORY_DRIVER || '(missing)')}`,
    'error'
  );
  pushCheck(
    'site_env.NEXT_PUBLIC_SITE_URL',
    isConfigured(siteEnv.NEXT_PUBLIC_SITE_URL) && !String(siteEnv.NEXT_PUBLIC_SITE_URL).includes('example.com'),
    `NEXT_PUBLIC_SITE_URL=${String(siteEnv.NEXT_PUBLIC_SITE_URL || '(missing)')}`,
    stage === 'production' ? 'error' : 'warn'
  );
  pushCheck(
    'site_env.SANITY_PROJECT_ID',
    isConfigured(siteEnv.SANITY_PROJECT_ID),
    `SANITY_PROJECT_ID=${isConfigured(siteEnv.SANITY_PROJECT_ID) ? '(set)' : '(missing/placeholder)'}`,
    stage === 'production' ? 'error' : 'warn'
  );
  pushCheck(
    'site_env.SANITY_READ_TOKEN',
    isConfigured(siteEnv.SANITY_READ_TOKEN),
    `SANITY_READ_TOKEN=${isConfigured(siteEnv.SANITY_READ_TOKEN) ? '(set)' : '(missing/placeholder)'}`,
    stage === 'production' ? 'error' : 'warn'
  );
  pushCheck(
    'site_env.SANITY_WRITE_TOKEN',
    isConfigured(siteEnv.SANITY_WRITE_TOKEN),
    `SANITY_WRITE_TOKEN=${isConfigured(siteEnv.SANITY_WRITE_TOKEN) ? '(set)' : '(missing/placeholder)'}`,
    stage === 'production' ? 'error' : 'warn'
  );

  printSummary(stage, siteSlug, checks);
  const failed = checks.filter((item) => !item.ok && item.severity !== 'warn');
  process.exit(failed.length > 0 ? 1 : 0);
}

function printSummary(stage, siteSlug, checks) {
  console.log(`Pilot readiness check`);
  console.log(`Stage: ${stage}`);
  console.log(`Site: ${siteSlug}`);
  console.log('');

  for (const check of checks) {
    if (check.ok) {
      console.log(`[PASS] ${check.id} -> ${check.detail}`);
      continue;
    }
    if (check.severity === 'warn') {
      console.log(`[WARN] ${check.id} -> ${check.detail}`);
      continue;
    }
    console.log(`[FAIL] ${check.id} -> ${check.detail}`);
  }

  const passCount = checks.filter((item) => item.ok).length;
  const warnCount = checks.filter((item) => !item.ok && item.severity === 'warn').length;
  const failCount = checks.filter((item) => !item.ok && item.severity !== 'warn').length;
  console.log('');
  console.log(`Summary: pass=${passCount} warn=${warnCount} fail=${failCount}`);
}

main();
