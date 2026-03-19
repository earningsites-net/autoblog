import path from 'node:path';

export function normalizeSiteSlug(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveOptionalPath(workspaceRoot: string, value?: string) {
  const trimmed = String(value || '').trim();
  return trimmed ? path.resolve(workspaceRoot, trimmed) : '';
}

export type RuntimePaths = {
  workspaceRoot: string;
  runtimeRoot: string;
  siteRuntimeRoot: string;
  registryPath: string;
  reportsRoot: string;
  n8nFlowChecksDir: string;
  engineDataRoot: string;
  portalDbPath: string;
};

export function resolveRuntimePaths(workspaceRoot: string, env: NodeJS.ProcessEnv = process.env): RuntimePaths {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const runtimeRoot = resolveOptionalPath(resolvedWorkspaceRoot, env.AUTOBLOG_RUNTIME_ROOT) || resolvedWorkspaceRoot;
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

export function resolveSitesSourceRoot(workspaceRoot: string) {
  return path.join(path.resolve(workspaceRoot), 'sites');
}

export function resolveSiteSourceDir(workspaceRoot: string, siteSlug: string) {
  return path.join(resolveSitesSourceRoot(workspaceRoot), normalizeSiteSlug(siteSlug));
}

export function resolveSiteBlueprintPath(workspaceRoot: string, siteSlug: string) {
  return path.join(resolveSiteSourceDir(workspaceRoot, siteSlug), 'site.blueprint.json');
}

export function resolveSiteReadmePath(workspaceRoot: string, siteSlug: string) {
  return path.join(resolveSiteSourceDir(workspaceRoot, siteSlug), 'README.md');
}

export function resolveSiteRuntimeDir(runtimePaths: RuntimePaths, siteSlug: string) {
  return path.join(runtimePaths.siteRuntimeRoot, normalizeSiteSlug(siteSlug));
}

export function resolveSiteRuntimeEnvPath(runtimePaths: RuntimePaths, siteSlug: string) {
  return path.join(resolveSiteRuntimeDir(runtimePaths, siteSlug), '.env.generated');
}

export function resolveSiteSeedContentDir(runtimePaths: RuntimePaths, siteSlug: string) {
  return path.join(resolveSiteRuntimeDir(runtimePaths, siteSlug), 'seed-content');
}

export function resolveSiteSeedContentPath(runtimePaths: RuntimePaths, siteSlug: string, fileName: string) {
  return path.join(resolveSiteSeedContentDir(runtimePaths, siteSlug), fileName);
}

export function resolveSiteHandoffDir(runtimePaths: RuntimePaths, siteSlug: string) {
  return path.join(resolveSiteRuntimeDir(runtimePaths, siteSlug), 'handoff');
}

export function resolveSiteHandoffPath(runtimePaths: RuntimePaths, siteSlug: string, fileName: string) {
  return path.join(resolveSiteHandoffDir(runtimePaths, siteSlug), fileName);
}
