#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_WORKFLOWS_DIR = 'infra/n8n/workflows';
const DEFAULT_REPORT_DIR = 'docs/ops/n8n-flow-checks';
const DEFAULT_AGENT_NAME = 'Crea sito blog autopopolato';

function parseArgs(argv) {
  const options = {
    mode: 'changed-only',
    workflowsDir: DEFAULT_WORKFLOWS_DIR,
    reportDir: DEFAULT_REPORT_DIR,
    importEnabled: true,
    smokeEnabled: false,
    writeReport: true,
    agentName: DEFAULT_AGENT_NAME,
    n8nBaseUrl: process.env.N8N_API_BASE_URL || '',
    n8nApiKey: process.env.N8N_API_KEY || '',
    n8nBasicUser: process.env.N8N_BASIC_AUTH_USER || '',
    n8nBasicPassword: process.env.N8N_BASIC_AUTH_PASSWORD || ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      options.mode = argv[i + 1] || options.mode;
      i += 1;
      continue;
    }
    if (arg === '--workflows-dir') {
      options.workflowsDir = argv[i + 1] || options.workflowsDir;
      i += 1;
      continue;
    }
    if (arg === '--report-dir') {
      options.reportDir = argv[i + 1] || options.reportDir;
      i += 1;
      continue;
    }
    if (arg === '--agent-name') {
      options.agentName = argv[i + 1] || options.agentName;
      i += 1;
      continue;
    }
    if (arg === '--n8n-base-url') {
      options.n8nBaseUrl = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--n8n-api-key') {
      options.n8nApiKey = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--n8n-basic-user') {
      options.n8nBasicUser = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--n8n-basic-password') {
      options.n8nBasicPassword = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--import') {
      options.importEnabled = true;
      continue;
    }
    if (arg === '--no-import') {
      options.importEnabled = false;
      continue;
    }
    if (arg === '--smoke') {
      options.smokeEnabled = true;
      continue;
    }
    if (arg === '--no-smoke') {
      options.smokeEnabled = false;
      continue;
    }
    if (arg === '--write-report') {
      options.writeReport = true;
      continue;
    }
    if (arg === '--no-write-report') {
      options.writeReport = false;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!['all', 'changed-only'].includes(options.mode)) {
    throw new Error(`Invalid --mode "${options.mode}". Use "all" or "changed-only".`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node skills/n8n-flow-guard/scripts/check_n8n_flows.mjs [options]

Options:
  --mode <all|changed-only>         Select workflows scope (default: changed-only)
  --workflows-dir <path>            Workflows directory (default: infra/n8n/workflows)
  --report-dir <path>               Report directory (default: docs/ops/n8n-flow-checks)
  --import | --no-import            Enable/disable n8n import (default: enabled)
  --smoke | --no-smoke              Enable/disable API smoke verification after import (default: disabled)
  --write-report | --no-write-report Enable/disable report writes (default: enabled)
  --agent-name <name>               Agent name used in handoff markdown
  --n8n-base-url <url>              n8n API base URL
  --n8n-api-key <key>               n8n API key (preferred auth)
  --n8n-basic-user <user>           n8n basic auth user (fallback auth)
  --n8n-basic-password <pass>       n8n basic auth password (fallback auth)
  --help                            Show this help
`);
}

function parseEnvContent(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    out[key] = value;
  }
  return out;
}

async function loadLocalRuntimeEnv(rootDir) {
  const files = ['infra/n8n/.env', '.env'];
  const merged = {};
  for (const relPath of files) {
    const absPath = path.resolve(rootDir, relPath);
    try {
      const content = await fs.readFile(absPath, 'utf8');
      Object.assign(merged, parseEnvContent(content));
    } catch {
      // Ignore missing env files.
    }
  }
  return merged;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function hydrateN8nOptions(options, runtimeEnv) {
  const protocol = firstNonEmpty(options.n8nProtocol, runtimeEnv.N8N_PROTOCOL, process.env.N8N_PROTOCOL, 'http');
  const host = firstNonEmpty(options.n8nHost, runtimeEnv.N8N_HOST, process.env.N8N_HOST);
  const port = firstNonEmpty(options.n8nPort, runtimeEnv.N8N_PORT, process.env.N8N_PORT);
  const computedBaseUrl = host ? `${protocol}://${host}${port ? `:${port}` : ''}` : '';

  options.n8nBaseUrl = firstNonEmpty(options.n8nBaseUrl, runtimeEnv.N8N_API_BASE_URL, process.env.N8N_API_BASE_URL, computedBaseUrl);
  options.n8nApiKey = firstNonEmpty(options.n8nApiKey, runtimeEnv.N8N_API_KEY, process.env.N8N_API_KEY);
  options.n8nBasicUser = firstNonEmpty(options.n8nBasicUser, runtimeEnv.N8N_BASIC_AUTH_USER, process.env.N8N_BASIC_AUTH_USER);
  options.n8nBasicPassword = firstNonEmpty(
    options.n8nBasicPassword,
    runtimeEnv.N8N_BASIC_AUTH_PASSWORD,
    process.env.N8N_BASIC_AUTH_PASSWORD
  );
}

function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function listChangedWorkflowPaths(workflowsDirRel) {
  const changed = new Set();
  const commands = [
    ['diff', '--name-only', '--', workflowsDirRel],
    ['diff', '--cached', '--name-only', '--', workflowsDirRel],
    ['ls-files', '--others', '--exclude-standard', '--', workflowsDirRel]
  ];

  for (const command of commands) {
    const out = runGit(command);
    if (!out) {
      continue;
    }
    for (const line of out.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.endsWith('.json')) {
        changed.add(trimmed);
      }
    }
  }

  return [...changed];
}

async function listAllWorkflowPaths(workflowsDirAbs, rootDir) {
  const entries = await fs.readdir(workflowsDirAbs, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(workflowsDirAbs, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listAllWorkflowPaths(abs, rootDir)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.relative(rootDir, abs));
    }
  }
  return files;
}

async function discoverWorkflowPaths(options, rootDir) {
  const workflowsDirAbs = path.resolve(rootDir, options.workflowsDir);
  const workflowsDirRel = path.relative(rootDir, workflowsDirAbs) || options.workflowsDir;

  if (options.mode === 'changed-only') {
    const gitAvailable = runGit(['rev-parse', '--show-toplevel']) !== null;
    if (!gitAvailable) {
      return listAllWorkflowPaths(workflowsDirAbs, rootDir);
    }
    const changed = listChangedWorkflowPaths(workflowsDirRel);
    return changed;
  }

  return listAllWorkflowPaths(workflowsDirAbs, rootDir);
}

function parseEnvExample(content) {
  const keys = new Set();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

async function loadEnvCatalog(rootDir) {
  const envFiles = ['.env.example', 'infra/n8n/.env.example'];
  const keys = new Set();
  for (const relPath of envFiles) {
    const abs = path.resolve(rootDir, relPath);
    try {
      const content = await fs.readFile(abs, 'utf8');
      for (const key of parseEnvExample(content)) {
        keys.add(key);
      }
    } catch {
      // Ignore missing optional env template files.
    }
  }
  return keys;
}

function extractEnvVars(value, out) {
  if (typeof value === 'string') {
    const regex = /\$env\.([A-Z0-9_]+)/g;
    let match = regex.exec(value);
    while (match) {
      out.add(match[1]);
      match = regex.exec(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      extractEnvVars(item, out);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) {
      extractEnvVars(child, out);
    }
  }
}

function hasTodoPlaceholder(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  const raw = JSON.stringify(node.parameters || {});
  return /\bTODO\b|replace-me|changeme|<TODO>/i.test(raw || '');
}

function validateConnections(connections, nodeNames, errors) {
  if (!connections || typeof connections !== 'object' || Array.isArray(connections)) {
    errors.push('connections must be an object');
    return;
  }

  for (const [sourceNode, channelMap] of Object.entries(connections)) {
    if (!nodeNames.has(sourceNode)) {
      errors.push(`connection source node "${sourceNode}" does not exist in nodes[]`);
    }

    if (!channelMap || typeof channelMap !== 'object' || Array.isArray(channelMap)) {
      errors.push(`connection map for "${sourceNode}" must be an object`);
      continue;
    }

    for (const [channel, routes] of Object.entries(channelMap)) {
      if (!Array.isArray(routes)) {
        errors.push(`connection channel "${sourceNode}.${channel}" must be an array`);
        continue;
      }
      routes.forEach((group, groupIndex) => {
        if (!Array.isArray(group)) {
          errors.push(`connection group "${sourceNode}.${channel}[${groupIndex}]" must be an array`);
          return;
        }
        group.forEach((route, routeIndex) => {
          if (!route || typeof route !== 'object') {
            errors.push(
              `connection target "${sourceNode}.${channel}[${groupIndex}][${routeIndex}]" must be an object`
            );
            return;
          }
          const targetNode = route.node;
          if (typeof targetNode !== 'string' || targetNode.trim().length === 0) {
            errors.push(
              `connection target "${sourceNode}.${channel}[${groupIndex}][${routeIndex}]" is missing route.node`
            );
            return;
          }
          if (!nodeNames.has(targetNode)) {
            errors.push(`connection target node "${targetNode}" does not exist in nodes[]`);
          }
        });
      });
    }
  }
}

function validateWorkflow(workflow, envCatalog) {
  const errors = [];
  const warnings = [];

  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return { errors: ['workflow root must be an object'], warnings, envVars: [] };
  }
  if (typeof workflow.name !== 'string' || workflow.name.trim().length === 0) {
    errors.push('workflow.name must be a non-empty string');
  }
  if (!Array.isArray(workflow.nodes)) {
    errors.push('workflow.nodes must be an array');
  }
  if (!workflow.connections || typeof workflow.connections !== 'object' || Array.isArray(workflow.connections)) {
    errors.push('workflow.connections must be an object');
  }

  const nodeIds = new Set();
  const nodeNames = new Set();
  if (Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach((node, index) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        errors.push(`nodes[${index}] must be an object`);
        return;
      }

      if (typeof node.id !== 'string' || node.id.trim().length === 0) {
        errors.push(`nodes[${index}] is missing id`);
      } else if (nodeIds.has(node.id)) {
        errors.push(`duplicate node id "${node.id}"`);
      } else {
        nodeIds.add(node.id);
      }

      if (typeof node.name !== 'string' || node.name.trim().length === 0) {
        errors.push(`nodes[${index}] is missing name`);
      } else if (nodeNames.has(node.name)) {
        warnings.push(`duplicate node name "${node.name}" can cause ambiguous connections`);
      } else {
        nodeNames.add(node.name);
      }

      if (typeof node.type !== 'string' || node.type.trim().length === 0) {
        errors.push(`nodes[${index}] is missing type`);
      }

      if (hasTodoPlaceholder(node)) {
        warnings.push(`node "${node.name || node.id || index}" still contains TODO/placeholder text`);
      }
    });
  }

  if (workflow.connections && typeof workflow.connections === 'object' && !Array.isArray(workflow.connections)) {
    validateConnections(workflow.connections, nodeNames, errors);
  }

  const envVars = new Set();
  extractEnvVars(workflow, envVars);
  const missingEnvExamples = [...envVars].filter((key) => !envCatalog.has(key)).sort();
  for (const missingKey of missingEnvExamples) {
    warnings.push(`env var "$env.${missingKey}" is not declared in .env examples`);
  }

  return { errors, warnings, envVars: [...envVars].sort() };
}

function sanitizeWorkflowForApi(workflow) {
  // Keep API payload minimal for broad compatibility across n8n API versions.
  // Some versions reject read-only/extra fields like `active`, `pinData`, `staticData`, `tags`.
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    // n8n 2.9.x requires `settings` on create/update payloads.
    settings: {}
  };
}

function getWorkflowId(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (typeof value.id === 'string' || typeof value.id === 'number') {
    return String(value.id);
  }
  if (value.data && (typeof value.data.id === 'string' || typeof value.data.id === 'number')) {
    return String(value.data.id);
  }
  return null;
}

function verifyRemoteWorkflow(localWorkflow, remoteWorkflow) {
  const issues = [];

  if (!remoteWorkflow || typeof remoteWorkflow !== 'object') {
    issues.push('remote workflow payload is empty or invalid');
    return issues;
  }

  const localName = typeof localWorkflow?.name === 'string' ? localWorkflow.name : '';
  const remoteName = typeof remoteWorkflow?.name === 'string' ? remoteWorkflow.name : '';
  if (localName && remoteName && localName !== remoteName) {
    issues.push(`workflow name mismatch (local="${localName}" remote="${remoteName}")`);
  }

  const localNodes = Array.isArray(localWorkflow?.nodes) ? localWorkflow.nodes : [];
  const remoteNodes = Array.isArray(remoteWorkflow?.nodes) ? remoteWorkflow.nodes : [];
  if (localNodes.length !== remoteNodes.length) {
    issues.push(`node count mismatch (local=${localNodes.length} remote=${remoteNodes.length})`);
  }

  const remoteNodeNames = new Set(
    remoteNodes
      .map((node) => (node && typeof node.name === 'string' ? node.name : null))
      .filter((value) => Boolean(value))
  );

  for (const localNode of localNodes) {
    const localNodeName = localNode && typeof localNode.name === 'string' ? localNode.name : null;
    if (!localNodeName) {
      continue;
    }
    if (!remoteNodeNames.has(localNodeName)) {
      issues.push(`missing remote node "${localNodeName}"`);
    }
    if (issues.length >= 8) {
      break;
    }
  }

  return issues;
}

function buildN8nClient(options) {
  const baseUrl = String(options.n8nBaseUrl || '').replace(/\/+$/, '');
  const apiKey = String(options.n8nApiKey || '').trim();
  const basicUser = String(options.n8nBasicUser || '').trim();
  const basicPassword = String(options.n8nBasicPassword || '').trim();

  if (!baseUrl) {
    return { enabled: false, reason: 'Missing N8N_API_BASE_URL' };
  }
  if (!apiKey && !(basicUser && basicPassword)) {
    return { enabled: false, reason: 'Missing N8N_API_KEY or basic auth credentials' };
  }

  const baseHeaders = { Accept: 'application/json' };
  if (apiKey) {
    baseHeaders['X-N8N-API-KEY'] = apiKey;
  }
  if (basicUser && basicPassword) {
    const encoded = Buffer.from(`${basicUser}:${basicPassword}`).toString('base64');
    baseHeaders.Authorization = `Basic ${encoded}`;
  }

  let preferredApiPrefix = null;

  async function request(method, route, body) {
    const headers = { ...baseHeaders };
    const init = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(`${baseUrl}${route}`, init);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`n8n request failed for ${method} ${route}: ${detail}`);
    }
    const rawText = await response.text();
    let data = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    }

    return { ok: response.ok, status: response.status, data, rawText };
  }

  function getApiPrefixes() {
    if (preferredApiPrefix === '/rest') {
      return ['/rest', '/api/v1'];
    }
    if (preferredApiPrefix === '/api/v1') {
      return ['/api/v1', '/rest'];
    }
    return ['/api/v1', '/rest'];
  }

  function withPrefix(prefix, resource) {
    const normalized = resource.startsWith('/') ? resource : `/${resource}`;
    return `${prefix}${normalized}`;
  }

  async function requestCompat(method, resource, body) {
    const prefixes = getApiPrefixes();
    let lastResponse = null;
    let lastRoute = '';

    for (const prefix of prefixes) {
      const route = withPrefix(prefix, resource);
      const response = await request(method, route, body);
      lastResponse = response;
      lastRoute = route;

      if (response.ok) {
        preferredApiPrefix = prefix;
        return { ...response, route };
      }

      // Try alternate API prefix only when endpoint is missing.
      if (response.status !== 404) {
        return { ...response, route };
      }
    }

    if (!lastResponse) {
      throw new Error(`n8n request failed for ${method} ${resource}: no response`);
    }
    return { ...lastResponse, route: lastRoute };
  }

  async function listWorkflows() {
    const response = await requestCompat('GET', '/workflows?limit=250');
    if (!response.ok) {
      const detail = response.rawText ? `: ${String(response.rawText).slice(0, 240)}` : '';
      throw new Error(`n8n list workflows failed (${response.status}) on ${response.route}${detail}`);
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    if (response.data && Array.isArray(response.data.workflows)) {
      return response.data.workflows;
    }
    return [];
  }

  async function upsert(workflow) {
    const payload = sanitizeWorkflowForApi(workflow);
    const remoteWorkflows = await listWorkflows();
    const byId = new Map(remoteWorkflows.map((item) => [String(item.id), item]));
    const byName = new Map(remoteWorkflows.map((item) => [String(item.name), item]));

    const candidatesByName = payload.name
      ? remoteWorkflows.filter((item) => String(item.name) === String(payload.name))
      : [];
    const preferredByName =
      candidatesByName.find((item) => item.archived !== true && item.isArchived !== true) ||
      (payload.name && byName.has(String(payload.name)) ? byName.get(String(payload.name)) : null);

    let target = null;
    if (workflow.id && byId.has(String(workflow.id))) {
      const idTarget = byId.get(String(workflow.id));
      const idIsArchived = idTarget && (idTarget.archived === true || idTarget.isArchived === true);

      // If JSON carries an old archived id, prefer the active workflow with same name to avoid duplicates.
      if (idIsArchived && preferredByName && preferredByName.id !== idTarget.id) {
        target = preferredByName;
      } else {
        target = idTarget;
      }
    } else if (preferredByName) {
      target = preferredByName;
    }

    const createWorkflow = async (reason = '') => {
      const createResponse = await requestCompat('POST', '/workflows', payload);
      if (!createResponse.ok) {
        const detail = createResponse.rawText ? `: ${String(createResponse.rawText).slice(0, 240)}` : '';
        throw new Error(`n8n create workflow failed (${createResponse.status}) on ${createResponse.route}${detail}`);
      }
      return {
        action: 'create',
        remoteId: getWorkflowId(createResponse.data),
        details: reason ? `Created workflow "${payload.name}" (${reason})` : `Created workflow "${payload.name}"`
      };
    };

    if (target && (target.archived === true || target.isArchived === true)) {
      return createWorkflow('existing workflow is archived');
    }

    if (!target) {
      return createWorkflow();
    }

    let updateResponse = await requestCompat('PATCH', `/workflows/${target.id}`, payload);
    if (!updateResponse.ok && (updateResponse.status === 404 || updateResponse.status === 405)) {
      updateResponse = await requestCompat('PUT', `/workflows/${target.id}`, payload);
    }
    if (!updateResponse.ok && updateResponse.status === 400) {
      const bodyText = String(updateResponse.rawText || '');
      if (/Cannot update an archived workflow/i.test(bodyText) || /archived workflow/i.test(bodyText)) {
        return createWorkflow('existing workflow is archived');
      }
    }
    if (!updateResponse.ok) {
      const detail = updateResponse.rawText ? `: ${String(updateResponse.rawText).slice(0, 240)}` : '';
      throw new Error(`n8n update workflow failed (${updateResponse.status}) on ${updateResponse.route}${detail}`);
    }

    return {
      action: 'update',
      remoteId: getWorkflowId(updateResponse.data) || String(target.id),
      details: `Updated workflow "${payload.name}" (id: ${target.id})`
    };
  }

  async function getWorkflow(id) {
    const response = await requestCompat('GET', `/workflows/${id}`);
    if (!response.ok) {
      const detail = response.rawText ? `: ${String(response.rawText).slice(0, 240)}` : '';
      throw new Error(`n8n get workflow failed (${response.status}) on ${response.route}${detail}`);
    }
    if (response.data && typeof response.data === 'object') {
      return response.data.data && typeof response.data.data === 'object' ? response.data.data : response.data;
    }
    throw new Error('n8n get workflow returned unexpected payload');
  }

  return { enabled: true, upsert, getWorkflow };
}

function computeWorkflowStatus(validationErrors, warnings, importResult, smokeResult, smokeEnabled) {
  if (validationErrors.length > 0) {
    return 'fail';
  }
  if (importResult && importResult.status === 'fail') {
    return 'fail';
  }
  if (smokeResult && smokeResult.status === 'fail') {
    return 'fail';
  }
  if (smokeEnabled && smokeResult && smokeResult.status === 'skipped') {
    return 'warn';
  }
  if (warnings.length > 0) {
    return 'warn';
  }
  if (importResult && importResult.status === 'skipped') {
    return 'warn';
  }
  return 'pass';
}

async function readPreviousReport(reportDirAbs) {
  const latestReportPath = path.join(reportDirAbs, 'latest-report.json');
  try {
    const raw = await fs.readFile(latestReportPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function computeRegressions(previousReport, currentWorkflows) {
  if (!previousReport || !Array.isArray(previousReport.workflows)) {
    return [];
  }
  const previousByPath = new Map(previousReport.workflows.map((w) => [w.path, w.status]));
  return currentWorkflows
    .filter((workflow) => previousByPath.get(workflow.path) === 'pass' && workflow.status === 'fail')
    .map((workflow) => ({
      path: workflow.path,
      name: workflow.name,
      previousStatus: 'pass',
      currentStatus: 'fail'
    }));
}

function renderHandoffMarkdown(report, agentName) {
  const failed = report.workflows.filter((w) => w.status === 'fail');
  const lines = [];
  lines.push(`# Handoff: n8n workflow failures -> ${agentName}`);
  lines.push('');
  lines.push(`- Run at: ${report.runAt}`);
  lines.push(`- Overall status: ${report.overallStatus}`);
  lines.push(`- Regressions: ${report.regression.count}`);
  lines.push('');
  lines.push('## Failed workflows');
  lines.push('');
  if (failed.length === 0) {
    lines.push('- No failed workflows found.');
  } else {
    for (const item of failed) {
      lines.push(`- \`${item.path}\` (${item.name || 'unknown'})`);
      for (const error of item.errors) {
        lines.push(`  - Error: ${error}`);
      }
      if (item.import && item.import.status === 'fail') {
        lines.push(`  - Import: ${item.import.details}`);
      }
    }
  }
  lines.push('');
  lines.push('## Requested actions');
  lines.push('');
  lines.push('1. Analizzare gli errori per workflow.');
  lines.push('2. Proporre fix mirati sui nodi/connessioni/config.');
  lines.push('3. Rieseguire il check locale con `npm run n8n:check:flows`.');
  lines.push('4. Confermare `overallStatus=pass` prima del deploy.');
  lines.push('');
  lines.push('## Regression delta');
  lines.push('');
  if (report.regression.count === 0) {
    lines.push('- Nessuna regressione rispetto all\'ultimo report.');
  } else {
    for (const item of report.regression.items) {
      lines.push(`- \`${item.path}\`: ${item.previousStatus} -> ${item.currentStatus}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const runtimeEnv = await loadLocalRuntimeEnv(rootDir);
  hydrateN8nOptions(options, runtimeEnv);
  const reportDirAbs = path.resolve(rootDir, options.reportDir);
  const historyDirAbs = path.join(reportDirAbs, 'history');
  const envCatalog = await loadEnvCatalog(rootDir);
  const workflowPaths = await discoverWorkflowPaths(options, rootDir);
  const n8nClient = buildN8nClient(options);
  const previousReport = await readPreviousReport(reportDirAbs);

  const workflows = [];

  for (const relPath of workflowPaths.sort()) {
    const absPath = path.resolve(rootDir, relPath);
    let raw = '';
    let workflow = null;
    const errors = [];
    const warnings = [];
    let envVars = [];

    try {
      raw = await fs.readFile(absPath, 'utf8');
      workflow = JSON.parse(raw);
    } catch (error) {
      errors.push(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (workflow) {
      const validation = validateWorkflow(workflow, envCatalog);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
      envVars = validation.envVars;
    }

    let importResult = {
      attempted: false,
      status: 'skipped',
      action: 'none',
      remoteId: null,
      details: 'Import disabled'
    };
    let smokeResult = {
      attempted: false,
      status: options.smokeEnabled ? 'skipped' : 'disabled',
      details: options.smokeEnabled ? 'Smoke disabled or skipped' : 'Smoke disabled'
    };

    if (options.importEnabled) {
      if (!n8nClient.enabled) {
        importResult = {
          attempted: false,
          status: 'skipped',
          action: 'none',
          remoteId: null,
          details: `Import skipped: ${n8nClient.reason}`
        };
      } else if (errors.length > 0) {
        importResult = {
          attempted: false,
          status: 'skipped',
          action: 'none',
          remoteId: null,
          details: 'Import skipped due to validation errors'
        };
      } else {
        try {
          const result = await n8nClient.upsert(workflow);
          importResult = {
            attempted: true,
            status: 'pass',
            action: result.action,
            remoteId: result.remoteId,
            details: result.details
          };

          if (options.smokeEnabled) {
            if (!result.remoteId) {
              smokeResult = {
                attempted: false,
                status: 'skipped',
                details: 'Smoke skipped: missing remote workflow id'
              };
            } else {
              try {
                const remoteWorkflow = await n8nClient.getWorkflow(result.remoteId);
                const issues = verifyRemoteWorkflow(workflow, remoteWorkflow);
                if (issues.length === 0) {
                  smokeResult = {
                    attempted: true,
                    status: 'pass',
                    details: `Smoke ok for workflow id ${result.remoteId}`
                  };
                } else {
                  smokeResult = {
                    attempted: true,
                    status: 'fail',
                    details: `Smoke mismatch for workflow id ${result.remoteId}: ${issues.join('; ')}`
                  };
                }
              } catch (error) {
                smokeResult = {
                  attempted: true,
                  status: 'fail',
                  details: error instanceof Error ? error.message : String(error)
                };
              }
            }
          }
        } catch (error) {
          importResult = {
            attempted: true,
            status: 'fail',
            action: 'none',
            remoteId: null,
            details: error instanceof Error ? error.message : String(error)
          };
          if (options.smokeEnabled) {
            smokeResult = {
              attempted: false,
              status: 'skipped',
              details: 'Smoke skipped due to import failure'
            };
          }
        }
      }
    } else if (options.smokeEnabled) {
      smokeResult = {
        attempted: false,
        status: 'skipped',
        details: 'Smoke skipped because import is disabled'
      };
    }

    const status = computeWorkflowStatus(errors, warnings, importResult, smokeResult, options.smokeEnabled);
    workflows.push({
      path: relPath,
      name: workflow && typeof workflow.name === 'string' ? workflow.name : null,
      status,
      errors,
      warnings,
      envVars,
      import: importResult,
      smoke: smokeResult
    });
  }

  const summary = {
    total: workflows.length,
    pass: workflows.filter((item) => item.status === 'pass').length,
    warn: workflows.filter((item) => item.status === 'warn').length,
    fail: workflows.filter((item) => item.status === 'fail').length
  };
  const smokeSummary = options.smokeEnabled
    ? {
        pass: workflows.filter((item) => item.smoke && item.smoke.status === 'pass').length,
        fail: workflows.filter((item) => item.smoke && item.smoke.status === 'fail').length,
        skipped: workflows.filter((item) => item.smoke && item.smoke.status === 'skipped').length
      }
    : null;
  const overallStatus = summary.fail > 0 ? 'fail' : summary.warn > 0 ? 'warn' : 'pass';
  const regressionItems = computeRegressions(previousReport, workflows);
  const report = {
    runAt: new Date().toISOString(),
    mode: options.mode,
    workflowsDir: path.resolve(rootDir, options.workflowsDir),
    reportDir: reportDirAbs,
    importEnabled: options.importEnabled,
    smokeEnabled: options.smokeEnabled,
    importConfigured: n8nClient.enabled,
    importReason: n8nClient.enabled ? 'configured' : n8nClient.reason,
    overallStatus,
    summary: smokeSummary ? { ...summary, smoke: smokeSummary } : summary,
    regression: {
      count: regressionItems.length,
      items: regressionItems
    },
    workflows
  };

  const shouldWriteHandoff = report.overallStatus === 'fail' || report.regression.count > 0;

  if (options.writeReport) {
    await ensureDir(historyDirAbs);
    const timestamp = report.runAt.replace(/[:.]/g, '-');
    const latestReportPath = path.join(reportDirAbs, 'latest-report.json');
    const historyReportPath = path.join(historyDirAbs, `${timestamp}.json`);
    await fs.writeFile(latestReportPath, `${JSON.stringify(report, null, 2)}\n`);
    await fs.writeFile(historyReportPath, `${JSON.stringify(report, null, 2)}\n`);

    const latestHandoffPath = path.join(reportDirAbs, 'latest-handoff.md');
    if (shouldWriteHandoff) {
      const handoff = renderHandoffMarkdown(report, options.agentName);
      await fs.writeFile(latestHandoffPath, handoff);
      await fs.writeFile(path.join(historyDirAbs, `${timestamp}-handoff.md`), handoff);
    } else {
      try {
        await fs.unlink(latestHandoffPath);
      } catch {
        // Ignore missing file.
      }
    }
  }

  console.log(`Checked workflows: ${summary.total}`);
  console.log(`Status: pass=${summary.pass} warn=${summary.warn} fail=${summary.fail}`);
  if (smokeSummary) {
    console.log(`Smoke: pass=${smokeSummary.pass} fail=${smokeSummary.fail} skipped=${smokeSummary.skipped}`);
  }
  console.log(`Overall: ${overallStatus}`);
  if (report.regression.count > 0) {
    console.log(`Regressions: ${report.regression.count}`);
  }
  if (options.writeReport) {
    console.log(`Report: ${path.join(options.reportDir, 'latest-report.json')}`);
    if (shouldWriteHandoff) {
      console.log(`Handoff: ${path.join(options.reportDir, 'latest-handoff.md')}`);
    }
  }

  process.exit(overallStatus === 'fail' ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
