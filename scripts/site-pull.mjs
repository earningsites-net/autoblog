#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_HOST = 'autoblog@autoblog-ops-prod.tail2bbeab.ts.net';
const DEFAULT_IDENTITY = '~/.ssh/autoblog_ionos';
const DEFAULT_SOURCE_ROOTS = ['/var/lib/autoblog/source-sites', '/srv/auto-blog-project/sites'];
const DEFAULT_RUNTIME_ROOT = '/var/lib/autoblog/sites';

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
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || WORKSPACE_ROOT,
    stdio: options.inherit ? 'inherit' : 'pipe',
    encoding: 'utf8'
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`);
  }
  return result;
}

function shellEscape(value) {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function remoteFileExists(host, identity, remotePath) {
  const result = spawnSync('ssh', ['-i', identity, host, `test -f ${shellEscape(remotePath)}`], {
    cwd: WORKSPACE_ROOT,
    stdio: 'pipe',
    encoding: 'utf8'
  });
  return result.status === 0;
}

function resolveSourceRoot({ host, identity, siteSlug, explicitSourceRoot }) {
  const normalizedExplicit = String(explicitSourceRoot || '').trim();
  if (normalizedExplicit) return normalizedExplicit;

  for (const candidateRoot of DEFAULT_SOURCE_ROOTS) {
    const probePath = `${candidateRoot.replace(/\/$/, '')}/${siteSlug}/site.blueprint.json`;
    if (remoteFileExists(host, identity, probePath)) return candidateRoot;
  }

  throw new Error(
    `Could not locate source-safe site files for ${siteSlug} on ${host}. Tried: ${DEFAULT_SOURCE_ROOTS.join(', ')}`
  );
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const siteSlug = slugify(positional[0]);
  if (!siteSlug) {
    throw new Error('Usage: node scripts/site-pull.mjs <site-slug> [--host autoblog@host] [--identity ~/.ssh/key] [--activate-local true] [--root-env .env]');
  }

  const host = String(flags.host || process.env.AUTOBLOG_SITE_PULL_HOST || DEFAULT_HOST).trim();
  const identity = expandHome(flags.identity || process.env.AUTOBLOG_SITE_PULL_IDENTITY || DEFAULT_IDENTITY);
  const sourceRoot = resolveSourceRoot({
    host,
    identity,
    siteSlug,
    explicitSourceRoot: flags['source-root'] || process.env.AUTOBLOG_SITE_PULL_SOURCE_ROOT
  });
  const runtimeRoot = String(flags['runtime-root'] || process.env.AUTOBLOG_SITE_PULL_RUNTIME_ROOT || DEFAULT_RUNTIME_ROOT).trim();
  const rootEnv = String(flags['root-env'] || '.env').trim();
  const activateLocal = asBool(flags['activate-local'], true);
  const includeRuntimeEnv = asBool(flags['runtime-env'], true);
  const keepTemp = asBool(flags['keep-temp'], false);
  const tempBase = path.resolve(
    WORKSPACE_ROOT,
    String(flags['temp-root'] || process.env.AUTOBLOG_SITE_PULL_TEMP_ROOT || path.join(os.tmpdir(), 'autoblog-site-pull')).trim()
  );

  ensureDir(tempBase);
  const tempDir = fs.mkdtempSync(path.join(tempBase, `${siteSlug}-`));
  const tempSiteDir = path.join(tempDir, siteSlug);

  const sourceRemote = `${host}:${sourceRoot.replace(/\/$/, '')}/${siteSlug}`;
  const runtimeEnvRemote = `${host}:${runtimeRoot.replace(/\/$/, '')}/${siteSlug}/.env.generated`;
  const localSiteDir = path.join(WORKSPACE_ROOT, 'sites', siteSlug);
  const localRuntimeEnvPath = path.join(localSiteDir, '.env.generated');

  console.error(`Pulling source-safe site files for ${siteSlug} from ${host}`);
  runCommand('scp', ['-i', identity, '-r', sourceRemote, tempDir], { inherit: false });

  console.error(`Syncing source-safe site files into repo`);
  const syncResult = runCommand(process.execPath, [path.join(WORKSPACE_ROOT, 'scripts', 'site-sync-source.mjs'), tempSiteDir], {
    inherit: false
  });

  let runtimeEnvCopied = false;
  if (includeRuntimeEnv) {
    ensureDir(localSiteDir);
    console.error(`Pulling runtime env for ${siteSlug}`);
    runCommand('scp', ['-i', identity, runtimeEnvRemote, localRuntimeEnvPath], { inherit: false });
    runtimeEnvCopied = fs.existsSync(localRuntimeEnvPath);
  }

  let siteUseResult = null;
  if (activateLocal && runtimeEnvCopied) {
    console.error(`Activating ${siteSlug} locally via site:use`);
    siteUseResult = runCommand('npm', ['run', 'site:use', '--', siteSlug, '--root-env', rootEnv], { inherit: false });
  }

  if (!keepTemp) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const syncJson = JSON.parse((syncResult.stdout || '{}').trim() || '{}');
  const output = {
    ok: true,
    siteSlug,
    host,
    sourceRoot,
    sourceRemote,
    runtimeEnvRemote: includeRuntimeEnv ? runtimeEnvRemote : null,
    localSiteDir,
    copiedSourceSafe: syncJson.copied || [],
    runtimeEnvCopied,
    activatedLocal: Boolean(siteUseResult),
    ignoredByDesign: syncJson.ignoredByDesign || ['.env.generated', 'seed-content/', 'handoff/'],
    tempDir: keepTemp ? tempDir : null,
    nextSteps: [
      'Review the pulled blueprint and README',
      'Commit only site.blueprint.json and README.md',
      'Do not commit .env.generated',
      siteUseResult ? 'Run npm run dev:studio' : `Run npm run site:use -- ${siteSlug} --root-env ${rootEnv}`
    ]
  };

  console.log(JSON.stringify(output, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
