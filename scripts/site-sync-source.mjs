#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DEST_ROOT = path.join(WORKSPACE_ROOT, 'sites');

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};
  const positional = [];

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = args[0] && !args[0].startsWith('--') ? args.shift() : 'true';
      flags[key] = value;
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

function copyIfDifferent(sourcePath, targetPath) {
  if (path.resolve(sourcePath) === path.resolve(targetPath)) {
    return { copied: false, reason: 'source and destination are the same file' };
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return { copied: true };
}

function displayPath(targetPath) {
  const relative = path.relative(WORKSPACE_ROOT, targetPath);
  return relative && !relative.startsWith('..') ? relative : targetPath;
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const sourceInput = positional[0];
  if (!sourceInput) {
    throw new Error('Usage: node scripts/site-sync-source.mjs <source-site-dir> [--site-slug slug] [--dest-root sites]');
  }

  const sourcePath = path.resolve(WORKSPACE_ROOT, sourceInput);
  const sourceDir = fs.statSync(sourcePath).isDirectory() ? sourcePath : path.dirname(sourcePath);
  const blueprintSourcePath = fs.statSync(sourcePath).isDirectory()
    ? path.join(sourceDir, 'site.blueprint.json')
    : sourcePath;

  if (!fs.existsSync(blueprintSourcePath)) {
    throw new Error(`Missing site blueprint in source: ${blueprintSourcePath}`);
  }

  const blueprint = JSON.parse(fs.readFileSync(blueprintSourcePath, 'utf8'));
  const siteSlug = slugify(flags['site-slug'] || blueprint.siteSlug);
  if (!siteSlug) {
    throw new Error('Cannot resolve siteSlug from source blueprint. Pass --site-slug explicitly.');
  }
  if (blueprint.siteSlug && slugify(blueprint.siteSlug) !== siteSlug) {
    throw new Error(`siteSlug mismatch: blueprint has "${blueprint.siteSlug}", requested "${siteSlug}"`);
  }

  const destRoot = path.resolve(WORKSPACE_ROOT, String(flags['dest-root'] || DEFAULT_DEST_ROOT));
  const targetDir = path.join(destRoot, siteSlug);
  const copied = [];
  const skipped = [];

  const blueprintTargetPath = path.join(targetDir, 'site.blueprint.json');
  const blueprintResult = copyIfDifferent(blueprintSourcePath, blueprintTargetPath);
  if (blueprintResult.copied) copied.push(displayPath(blueprintTargetPath));
  else skipped.push({ file: displayPath(blueprintTargetPath), reason: blueprintResult.reason });

  const readmeSourcePath = path.join(sourceDir, 'README.md');
  if (fs.existsSync(readmeSourcePath)) {
    const readmeTargetPath = path.join(targetDir, 'README.md');
    const readmeResult = copyIfDifferent(readmeSourcePath, readmeTargetPath);
    if (readmeResult.copied) copied.push(displayPath(readmeTargetPath));
    else skipped.push({ file: displayPath(readmeTargetPath), reason: readmeResult.reason });
  }

  console.log(JSON.stringify({
    ok: true,
    siteSlug,
    sourceDir,
    targetDir,
    copied,
    skipped,
    ignoredByDesign: ['.env.generated', 'seed-content/', 'handoff/'],
    nextSteps: [
      `Review ${displayPath(blueprintTargetPath)}`,
      'Commit/push source-safe site files only',
      'Deploy apps/web on Vercel for this site'
    ]
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
