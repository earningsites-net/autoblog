import path from 'node:path';

function normalizeSiteSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveOptionalPath(workspaceRoot, value) {
  const trimmed = String(value || '').trim();
  return trimmed ? path.resolve(workspaceRoot, trimmed) : '';
}

export function resolveRuntimePaths({ workspaceRoot, env = process.env } = {}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot || process.cwd());
  const runtimeRoot =
    resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_RUNTIME_ROOT) || resolvedWorkspaceRoot;
  const siteRuntimeRoot =
    resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_RUNTIME_SITES_ROOT) ||
    path.join(runtimeRoot, 'sites');
  const registryPath =
    resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_SITE_REGISTRY_PATH) ||
    path.join(siteRuntimeRoot, 'registry.json');
  const reportsRoot =
    resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_REPORTS_ROOT) ||
    (runtimeRoot === resolvedWorkspaceRoot
      ? path.join(resolvedWorkspaceRoot, 'docs', 'ops')
      : path.join(runtimeRoot, 'reports'));
  const n8nFlowChecksDir =
    resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_N8N_FLOW_CHECKS_DIR) ||
    path.join(reportsRoot, 'n8n-flow-checks');
  const engineDataRoot =
    resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_ENGINE_DATA_ROOT) ||
    (runtimeRoot === resolvedWorkspaceRoot
      ? path.join(resolvedWorkspaceRoot, 'apps', 'engine', 'data')
      : path.join(runtimeRoot, 'engine'));
  const portalDbPath =
    resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_PORTAL_DB_PATH || env.PORTAL_DB_PATH) ||
    path.join(engineDataRoot, 'portal.db');

  return {
    workspaceRoot: resolvedWorkspaceRoot,
    runtimeRoot,
    siteRuntimeRoot,
    registryPath,
    reportsRoot,
    n8nFlowChecksDir,
    engineDataRoot,
    portalDbPath
  };
}

export function resolveSitesSourceRoot(workspaceRoot) {
  return path.join(path.resolve(workspaceRoot || process.cwd()), 'sites');
}

export function resolveSiteSourceDir(workspaceRoot, siteSlug) {
  return path.join(resolveSitesSourceRoot(workspaceRoot), normalizeSiteSlug(siteSlug));
}

export function resolveSiteBlueprintPath(workspaceRoot, siteSlug) {
  return path.join(resolveSiteSourceDir(workspaceRoot, siteSlug), 'site.blueprint.json');
}

export function resolveSiteReadmePath(workspaceRoot, siteSlug) {
  return path.join(resolveSiteSourceDir(workspaceRoot, siteSlug), 'README.md');
}

export function resolveSiteRuntimeDir(runtimePaths, siteSlug) {
  return path.join(runtimePaths.siteRuntimeRoot, normalizeSiteSlug(siteSlug));
}

export function resolveSiteRuntimeEnvPath(runtimePaths, siteSlug) {
  return path.join(resolveSiteRuntimeDir(runtimePaths, siteSlug), '.env.generated');
}

export function resolveSiteSeedContentDir(runtimePaths, siteSlug) {
  return path.join(resolveSiteRuntimeDir(runtimePaths, siteSlug), 'seed-content');
}

export function resolveSiteSeedContentFile(runtimePaths, siteSlug, fileName) {
  return path.join(resolveSiteSeedContentDir(runtimePaths, siteSlug), fileName);
}

export function resolveSiteHandoffDir(runtimePaths, siteSlug) {
  return path.join(resolveSiteRuntimeDir(runtimePaths, siteSlug), 'handoff');
}

export function resolveSiteHandoffFile(runtimePaths, siteSlug, fileName) {
  return path.join(resolveSiteHandoffDir(runtimePaths, siteSlug), fileName);
}

export function displayPath(workspaceRoot, filePath) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot || process.cwd());
  const resolvedFilePath = path.resolve(filePath);
  const relative = path.relative(resolvedWorkspaceRoot, resolvedFilePath);
  return relative && !relative.startsWith('..') ? relative : resolvedFilePath;
}
