#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT_DIR = path.join(WORKSPACE_ROOT, '.runtime-backups');

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = args[0] && !args[0].startsWith('--') ? args.shift() : 'true';
    flags[key] = value;
  }

  return flags;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function collectSiteRuntimeFiles() {
  const sitesRoot = path.join(WORKSPACE_ROOT, 'sites');
  if (!fs.existsSync(sitesRoot)) return [];

  return fs
    .readdirSync(sitesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name !== 'templates')
    .flatMap((entry) => {
      const siteDir = path.join(sitesRoot, entry.name);
      return ['site.blueprint.json', 'README.md', '.env.generated']
        .map((name) => path.join(siteDir, name))
        .filter((filePath) => fs.existsSync(filePath));
    });
}

function copyIntoSnapshot(filePath, snapshotRoot, manifest) {
  if (!fs.existsSync(filePath)) {
    manifest.missing.push(path.relative(WORKSPACE_ROOT, filePath));
    return;
  }

  const relative = path.relative(WORKSPACE_ROOT, filePath);
  const target = path.join(snapshotRoot, relative);
  ensureDir(path.dirname(target));
  fs.copyFileSync(filePath, target);
  manifest.copied.push(relative);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(WORKSPACE_ROOT, String(flags['out-dir'] || DEFAULT_OUT_DIR));
  const label = String(flags.label || 'runtime-state');
  const snapshotRoot = path.join(outDir, `${label}-${timestamp()}`);

  ensureDir(snapshotRoot);

  const manifest = {
    ok: true,
    createdAt: new Date().toISOString(),
    workspaceRoot: WORKSPACE_ROOT,
    snapshotRoot,
    copied: [],
    missing: []
  };

  const explicitFiles = [
    path.join(WORKSPACE_ROOT, 'sites', 'registry.json'),
    path.join(WORKSPACE_ROOT, 'apps', 'engine', 'data', 'portal.db'),
    path.join(WORKSPACE_ROOT, 'apps', 'engine', 'data', 'portal.db-shm'),
    path.join(WORKSPACE_ROOT, 'apps', 'engine', 'data', 'portal.db-wal')
  ];

  for (const filePath of [...explicitFiles, ...collectSiteRuntimeFiles()]) {
    copyIntoSnapshot(filePath, snapshotRoot, manifest);
  }

  const manifestPath = path.join(snapshotRoot, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ...manifest,
    manifestPath
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
