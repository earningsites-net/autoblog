#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveRuntimePaths,
  resolveSiteRuntimeEnvPath
} from './lib/runtime-paths.mjs';

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

function copyIntoSnapshot(filePath, targetRelativePath, snapshotRoot, manifest) {
  if (!fs.existsSync(filePath)) {
    manifest.missing.push(targetRelativePath);
    return;
  }

  const target = path.join(snapshotRoot, targetRelativePath);
  ensureDir(path.dirname(target));
  fs.copyFileSync(filePath, target);
  manifest.copied.push(targetRelativePath);
}

function listRuntimeSiteSlugs(runtimePaths) {
  if (!fs.existsSync(runtimePaths.siteRuntimeRoot)) return [];
  return fs
    .readdirSync(runtimePaths.siteRuntimeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(WORKSPACE_ROOT, String(flags['out-dir'] || DEFAULT_OUT_DIR));
  const label = String(flags.label || 'runtime-state');
  const snapshotRoot = path.join(outDir, `${label}-${timestamp()}`);
  const runtimePaths = resolveRuntimePaths({ workspaceRoot: WORKSPACE_ROOT, env: process.env });

  ensureDir(snapshotRoot);

  const manifest = {
    ok: true,
    createdAt: new Date().toISOString(),
    workspaceRoot: WORKSPACE_ROOT,
    runtimeRoot: runtimePaths.runtimeRoot,
    snapshotRoot,
    copied: [],
    missing: []
  };

  copyIntoSnapshot(runtimePaths.registryPath, 'runtime/sites/registry.json', snapshotRoot, manifest);
  copyIntoSnapshot(runtimePaths.portalDbPath, 'runtime/engine/portal.db', snapshotRoot, manifest);
  copyIntoSnapshot(`${runtimePaths.portalDbPath}-shm`, 'runtime/engine/portal.db-shm', snapshotRoot, manifest);
  copyIntoSnapshot(`${runtimePaths.portalDbPath}-wal`, 'runtime/engine/portal.db-wal', snapshotRoot, manifest);

  for (const siteSlug of listRuntimeSiteSlugs(runtimePaths)) {
    copyIntoSnapshot(
      resolveSiteRuntimeEnvPath(runtimePaths, siteSlug),
      path.join('runtime', 'sites', siteSlug, '.env.generated'),
      snapshotRoot,
      manifest
    );
  }

  const manifestPath = path.join(snapshotRoot, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify(
      {
        ...manifest,
        manifestPath
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
