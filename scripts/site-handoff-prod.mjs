#!/usr/bin/env node
import './load-local-env.mjs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_HOST = 'root@87.106.29.31';
const DEFAULT_IDENTITY = '~/.ssh/autoblog_ionos';
const DEFAULT_REPO_ROOT = '/srv/auto-blog-project';
const DEFAULT_RUNTIME_ROOT = '/var/lib/autoblog';

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  const flags = {};
  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = args[0] && !args[0].startsWith('--') ? args.shift() : 'true';
      flags[key] = next;
      continue;
    }
    positional.push(token);
  }
  return { positional, flags };
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

function asBool(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return defaultValue;
}

function expandHome(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('~/')) return raw;
  return path.join(os.homedir(), raw.slice(2));
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || WORKSPACE_ROOT,
    stdio: options.inherit ? 'inherit' : 'pipe',
    encoding: 'utf8'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`);
  }
  return result;
}

function parseJsonFromMixedOutput(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {}

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const candidate = lines.slice(index).join('\n').trim();
    if (!candidate.startsWith('{') && !candidate.startsWith('[')) continue;
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  throw new Error(`Unable to parse JSON from remote output: ${text}`);
}

function buildRemoteCommand({
  repoRoot,
  runtimeRoot,
  siteSlug,
  ownerEmail,
  billingMode,
  tempPassword,
  revokeOtherOwners,
  webBaseUrl,
  studioUrl,
  portalDatabaseUrl
}) {
  const parts = [
    'cd',
    shellEscape(repoRoot),
    '&&',
    'sudo',
    '-u',
    'autoblog',
    'env',
    `AUTOBLOG_RUNTIME_ROOT=${shellEscape(runtimeRoot)}`,
  ];
  if (portalDatabaseUrl) {
    parts.push(`PORTAL_DATABASE_URL=${shellEscape(portalDatabaseUrl)}`);
  }

  parts.push(
    'node',
    'scripts/autoblog.mjs',
    'handoff-site',
    shellEscape(siteSlug),
    '--owner-email',
    shellEscape(ownerEmail),
    '--billing-mode',
    shellEscape(billingMode)
  );

  if (tempPassword) {
    parts.push('--temp-password', shellEscape(tempPassword));
  }
  if (webBaseUrl) {
    parts.push('--web-base-url', shellEscape(webBaseUrl));
  }
  if (studioUrl) {
    parts.push('--studio-url', shellEscape(studioUrl));
  }
  if (revokeOtherOwners) {
    parts.push('--revoke-other-owners');
  }

  return parts.join(' ');
}

function printUsage() {
  console.log('Usage: node scripts/site-handoff-prod.mjs <site-slug> --owner-email buyer@example.com [--billing-mode customer_paid|incubating|complimentary] [--temp-password <password>] [--web-base-url <url>] [--studio-url <url>] [--revoke-other-owners] [--portal-database-url <url>]');
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (flags.help !== undefined) {
    printUsage();
    return;
  }
  const siteSlug = slugify(positional[0]);
  const ownerEmail = normalizeEmail(flags['owner-email']);
  if (!siteSlug || !ownerEmail) {
    printUsage();
    throw new Error('Missing required arguments');
  }

  const host = String(flags.host || process.env.AUTOBLOG_SITE_HANDOFF_PROD_HOST || DEFAULT_HOST).trim();
  const identity = expandHome(flags.identity || process.env.AUTOBLOG_SITE_HANDOFF_PROD_IDENTITY || DEFAULT_IDENTITY);
  const repoRoot = String(flags['repo-root'] || process.env.AUTOBLOG_SITE_HANDOFF_PROD_REPO_ROOT || DEFAULT_REPO_ROOT).trim();
  const runtimeRoot = String(flags['runtime-root'] || process.env.AUTOBLOG_SITE_HANDOFF_PROD_RUNTIME_ROOT || DEFAULT_RUNTIME_ROOT).trim();
  const billingMode = String(flags['billing-mode'] || 'customer_paid').trim().toLowerCase();
  const tempPassword = typeof flags['temp-password'] === 'string' ? String(flags['temp-password']) : '';
  const webBaseUrl = String(flags['web-base-url'] || '').trim();
  const studioUrl = String(flags['studio-url'] || '').trim();
  const revokeOtherOwners = asBool(flags['revoke-other-owners'], false);
  const portalDatabaseUrl = String(
    flags['portal-database-url'] ||
      process.env.AUTOBLOG_SITE_HANDOFF_PROD_PORTAL_DATABASE_URL ||
      process.env.PORTAL_DATABASE_URL ||
      process.env.DATABASE_URL ||
      ''
  ).trim();

  const remoteCommand = buildRemoteCommand({
    repoRoot,
    runtimeRoot,
    siteSlug,
    ownerEmail,
    billingMode,
    tempPassword,
    revokeOtherOwners,
    webBaseUrl,
    studioUrl,
    portalDatabaseUrl
  });

  const result = runCommand('ssh', ['-i', identity, host, remoteCommand], { inherit: false });
  const parsed = parseJsonFromMixedOutput(result.stdout || '');
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'production',
        host,
        siteSlug,
        ownerEmail,
        runtimeRoot,
        result: parsed
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
