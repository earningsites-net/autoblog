import './load-local-env';
import path from 'node:path';
import Fastify from 'fastify';
import { generationJobRequestSchema } from '@autoblog/factory-sdk';
import { createWorkflowRunner } from './adapters/workflow-runners';
import { DefaultEngineService } from './services/engine-service';
import { FactoryOpsService } from './services/factory-ops';
import { InMemoryJobStore } from './services/job-store';
import { LocalSiteRegistry } from './services/site-registry';

const app = Fastify({ logger: true });

const workspaceRoot = process.env.WORKSPACE_ROOT || path.resolve(process.cwd(), '..', '..');
const siteRegistry = new LocalSiteRegistry(workspaceRoot);
const jobStore = new InMemoryJobStore();
const engine = new DefaultEngineService(siteRegistry, jobStore, createWorkflowRunner);
const factoryOps = new FactoryOpsService(workspaceRoot);

function parseGenerationRequest(body: unknown) {
  return generationJobRequestSchema.parse(body);
}

async function handleStageRoute(stage: 'topics' | 'brief' | 'articles' | 'images' | 'qa' | 'publish', body: unknown) {
  const request = parseGenerationRequest(body);
  const normalizedRequest = { ...request, stage };
  return stage === 'publish' ? engine.runStage(normalizedRequest) : engine.runStage(normalizedRequest);
}

app.get('/healthz', async () => ({ ok: true, service: 'autoblog-engine', now: new Date().toISOString() }));

app.post('/v1/generation/topics', async (req, reply) => {
  try {
    return await handleStageRoute('topics', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/brief', async (req, reply) => {
  try {
    return await handleStageRoute('brief', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/articles', async (req, reply) => {
  try {
    return await handleStageRoute('articles', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/images', async (req, reply) => {
  try {
    return await handleStageRoute('images', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/generation/qa', async (req, reply) => {
  try {
    return await handleStageRoute('qa', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/publish', async (req, reply) => {
  try {
    return await handleStageRoute('publish', req.body);
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.post('/v1/pipelines/run', async (req, reply) => {
  try {
    const request = parseGenerationRequest(req.body);
    return await engine.runPipeline({ ...request, stage: 'pipeline' });
  } catch (error) {
    return reply.code(400).send({ ok: false, error: (error as Error).message });
  }
});

app.get('/v1/jobs/:jobId', async (req, reply) => {
  const params = req.params as { jobId: string };
  const job = await engine.getJob(params.jobId);
  if (!job) {
    return reply.code(404).send({ ok: false, error: 'Job not found' });
  }
  return job;
});

app.get('/v1/sites/:siteSlug/health', async (req) => {
  const params = req.params as { siteSlug: string };
  return engine.health(params.siteSlug);
});

app.get('/v1/content/categories', async (req, reply) => {
  const query = req.query as { siteSlug?: string };
  const siteSlug = query.siteSlug;
  if (!siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug query param is required' });
  }

  const site = await siteRegistry.getSite(siteSlug);
  if (!site) {
    return reply.code(404).send({ ok: false, error: `Unknown site: ${siteSlug}` });
  }

  return {
    siteSlug,
    source: 'blueprint',
    items: site.categories.map((category, index) => ({
      _id: `cat-${category.slug || index}`,
      title: category.title,
      slug: category.slug,
      description: category.description,
      accent: category.accent
    }))
  };
});

app.get('/v1/content/articles', async (req, reply) => {
  const query = req.query as { siteSlug?: string };
  const siteSlug = query.siteSlug;
  if (!siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug query param is required' });
  }

  const site = await siteRegistry.getSite(siteSlug);
  if (!site) {
    return reply.code(404).send({ ok: false, error: `Unknown site: ${siteSlug}` });
  }

  // Placeholder read-side endpoint. Real implementation should query the publishing target through a repository/adapter.
  return {
    siteSlug,
    source: 'publisher-read-adapter-pending',
    items: []
  };
});

app.get('/v1/factory/sites', async () => {
  const sites = await siteRegistry.listSites();
  return {
    count: sites.length,
    sites: sites.map((site) => ({
      siteSlug: site.siteSlug,
      brandName: site.brandName,
      publishingTarget: site.publishingTarget.kind,
      deploymentTarget: site.deploymentTarget.kind
    }))
  };
});

app.get('/api/factory/site/:siteSlug/status', async (req) => {
  const params = req.params as { siteSlug: string };
  return factoryOps.siteStatus(params.siteSlug);
});

app.get('/api/factory/options', async () => {
  return {
    nichePresets: factoryOps.listNichePresets(),
    businessModes: ['transfer_first', 'managed'],
    themeTones: ['auto', 'editorial', 'luxury', 'wellness', 'playful', 'technical'],
    themeRecipes: [
      'bold_magazine',
      'editorial_luxury',
      'warm_wellness',
      'playful_kids',
      'technical_minimal',
      'noir_luxury_dark',
      'midnight_wellness_dark',
      'arcade_play_dark'
    ],
    topicSources: ['suggest', 'synthetic'],
    topicStatuses: ['queued', 'brief_ready', 'generated', 'skipped']
  };
});

app.post('/api/factory/site/create', async (req, reply) => {
  const body = (req.body || {}) as {
    siteSlug?: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    applyCmsMutations?: boolean;
    force?: boolean;
  };
  if (!body.siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  }
  const result = await factoryOps.createSite({
    siteSlug: body.siteSlug,
    blueprint: body.blueprint,
    brandName: body.brandName,
    locale: body.locale,
    businessMode: body.businessMode,
    nichePreset: body.nichePreset,
    themeTone: body.themeTone,
    themeRecipe: body.themeRecipe,
    applyCmsMutations: body.applyCmsMutations,
    force: body.force
  });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/launch', async (req, reply) => {
  const body = (req.body || {}) as {
    siteSlug?: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    topicCount?: number;
    topicStatus?: 'queued' | 'brief_ready' | 'generated' | 'skipped';
    topicSource?: 'suggest' | 'synthetic';
    replaceTopics?: boolean;
    applySanity?: boolean;
    runPrepopulate?: boolean;
    prepopulateTargetPublishedCount?: number;
    prepopulateBatchSize?: number;
    force?: boolean;
  };
  if (!body.siteSlug) {
    return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  }
  const result = await factoryOps.launchSite({
    siteSlug: body.siteSlug,
    blueprint: body.blueprint,
    brandName: body.brandName,
    locale: body.locale,
    businessMode: body.businessMode,
    nichePreset: body.nichePreset,
    themeTone: body.themeTone,
    themeRecipe: body.themeRecipe,
    topicCount: body.topicCount,
    topicStatus: body.topicStatus,
    topicSource: body.topicSource,
    replaceTopics: body.replaceTopics,
    applySanity: body.applySanity,
    runPrepopulate: body.runPrepopulate,
    prepopulateTargetPublishedCount: body.prepopulateTargetPublishedCount,
    prepopulateBatchSize: body.prepopulateBatchSize,
    force: body.force
  });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/seed-cms', async (req, reply) => {
  const body = (req.body || {}) as { siteSlug?: string; apply?: boolean };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.seedCms({ siteSlug: body.siteSlug, apply: body.apply });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/discover-topics', async (req, reply) => {
  const body = (req.body || {}) as {
    siteSlug?: string;
    count?: number;
    status?: 'queued' | 'brief_ready' | 'generated' | 'skipped';
    source?: 'suggest' | 'synthetic';
    replace?: boolean;
    apply?: boolean;
  };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.discoverTopics({
    siteSlug: body.siteSlug,
    count: body.count,
    status: body.status,
    source: body.source,
    replace: body.replace,
    apply: body.apply
  });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/prepopulate', async (req, reply) => {
  const body = (req.body || {}) as { siteSlug?: string; targetPublishedCount?: number; batchSize?: number };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.prepopulate({
    siteSlug: body.siteSlug,
    targetPublishedCount: body.targetPublishedCount,
    batchSize: body.batchSize
  });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/api/factory/site/handoff-pack', async (req, reply) => {
  const body = (req.body || {}) as { siteSlug?: string };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.handoffPack({ siteSlug: body.siteSlug });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites', async (req, reply) => {
  const body = (req.body || {}) as {
    siteSlug?: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    applyCmsMutations?: boolean;
    force?: boolean;
  };
  if (!body.siteSlug) return reply.code(400).send({ ok: false, error: 'siteSlug is required' });
  const result = await factoryOps.createSite(body as {
    siteSlug: string;
    blueprint?: string;
    brandName?: string;
    locale?: string;
    businessMode?: 'transfer_first' | 'managed';
    nichePreset?: 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';
    themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    themeRecipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    applyCmsMutations?: boolean;
    force?: boolean;
  });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites/:id/provision', async (req, reply) => {
  const params = req.params as { id: string };
  const result = await factoryOps.createSite({ siteSlug: params.id, force: false });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites/:id/seed', async (req, reply) => {
  const params = req.params as { id: string };
  const body = (req.body || {}) as { apply?: boolean };
  const result = await factoryOps.seedCms({ siteSlug: params.id, apply: body.apply });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites/:id/deploy', async (req, reply) => {
  const params = req.params as { id: string };
  const result = await factoryOps.handoffPack({ siteSlug: params.id });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.post('/v1/factory/sites/:id/export-handoff', async (req, reply) => {
  const params = req.params as { id: string };
  const result = await factoryOps.handoffPack({ siteSlug: params.id });
  if (!result.ok) return reply.code(400).send(result);
  return result;
});

app.get('/ops/factory', async (_req, reply) => {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Factory Ops</title>
  <style>
    :root { --bg:#0f1115; --panel:#171b22; --line:#283140; --text:#e8edf7; --muted:#9ea8b8; --accent:#6cb5ff; --ok:#44d19a; --warn:#ffcc66; --err:#ff6b6b; }
    body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);max-width:1100px;margin:16px auto;padding:0 16px;}
    h1,h2{margin:0 0 8px;}
    .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;}
    .panel{grid-column:span 12;border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:14px;}
    .col-6{grid-column:span 6;}
    .col-4{grid-column:span 4;}
    .col-3{grid-column:span 3;}
    .col-12{grid-column:span 12;}
    label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px;}
    input,select,button{width:100%;box-sizing:border-box;background:#0f131a;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px 10px;}
    button{cursor:pointer;font-weight:600;}
    button.primary{background:var(--accent);color:#041526;border-color:transparent;}
    button.secondary{background:#1f2733;}
    .row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px;margin-bottom:10px;}
    .hint{font-size:12px;color:var(--muted);}
    .toggles{display:flex;gap:14px;flex-wrap:wrap;}
    .toggle{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text);}
    .toggle input{width:auto;}
    pre{margin:0;background:#0a0f15;color:#d0e7ff;border:1px solid #223049;padding:12px;overflow:auto;border-radius:10px;min-height:220px;}
    .status{font-size:12px;color:var(--muted);}
    .status.ok{color:var(--ok);}
    .status.err{color:var(--err);}
    @media (max-width: 900px){
      .col-6,.col-4,.col-3{grid-column:span 12;}
    }
  </style>
</head>
<body>
  <h1>Factory Ops</h1>
  <p class="hint">Pannello interno: crea un nuovo sito con un click (create + seed + discover + handoff), con prepopulate opzionale.</p>
  <div class="grid">
    <section class="panel">
      <h2>Launch Site</h2>
      <div class="row">
        <div class="col-4">
          <label>Site slug</label>
          <input id="siteSlug" value="new-site" />
        </div>
        <div class="col-4">
          <label>Brand name</label>
          <input id="brandName" placeholder="My Brand" />
        </div>
        <div class="col-4">
          <label>Locale</label>
          <input id="locale" value="en-US" />
        </div>
      </div>
      <div class="row">
        <div class="col-3">
          <label>Blueprint</label>
          <input id="blueprint" value="home-diy-magazine" />
        </div>
        <div class="col-3">
          <label>Business mode</label>
          <select id="businessMode">
            <option value="transfer_first">transfer_first</option>
            <option value="managed">managed</option>
          </select>
        </div>
        <div class="col-3">
          <label>Niche preset</label>
          <select id="nichePreset">
            <option value="">(none)</option>
            <option value="home_diy">home_diy</option>
            <option value="luxury_living">luxury_living</option>
            <option value="couple_wellness">couple_wellness</option>
            <option value="kids_play">kids_play</option>
          </select>
        </div>
        <div class="col-3">
          <label>Theme tone</label>
          <select id="themeTone">
            <option value="auto">auto</option>
            <option value="editorial">editorial</option>
            <option value="luxury">luxury</option>
            <option value="wellness">wellness</option>
            <option value="playful">playful</option>
            <option value="technical">technical</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="col-3">
          <label>Theme recipe</label>
          <select id="themeRecipe">
            <option value="">(auto)</option>
            <option value="bold_magazine">bold_magazine</option>
            <option value="editorial_luxury">editorial_luxury</option>
            <option value="warm_wellness">warm_wellness</option>
            <option value="playful_kids">playful_kids</option>
            <option value="technical_minimal">technical_minimal</option>
            <option value="noir_luxury_dark">noir_luxury_dark</option>
            <option value="midnight_wellness_dark">midnight_wellness_dark</option>
            <option value="arcade_play_dark">arcade_play_dark</option>
          </select>
        </div>
        <div class="col-3">
          <label>Topic count</label>
          <input id="topicCount" type="number" value="60" min="1" />
        </div>
        <div class="col-3">
          <label>Topic source</label>
          <select id="topicSource">
            <option value="suggest">suggest</option>
            <option value="synthetic">synthetic</option>
          </select>
        </div>
        <div class="col-3">
          <label>Topic status</label>
          <select id="topicStatus">
            <option value="brief_ready">brief_ready</option>
            <option value="queued">queued</option>
            <option value="generated">generated</option>
            <option value="skipped">skipped</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="col-4">
          <label>Prepopulate target published</label>
          <input id="prepopulateTargetPublishedCount" type="number" value="30" min="1" />
        </div>
        <div class="col-4">
          <label>Prepopulate batch size</label>
          <input id="prepopulateBatchSize" type="number" value="3" min="1" />
        </div>
      </div>
      <div class="row">
        <div class="col-12 toggles">
          <label class="toggle"><input id="applySanity" type="checkbox" checked /> Apply Sanity mutations</label>
          <label class="toggle"><input id="runPrepopulate" type="checkbox" /> Run prepopulate</label>
          <label class="toggle"><input id="replaceTopics" type="checkbox" checked /> Replace topic candidates</label>
          <label class="toggle"><input id="force" type="checkbox" /> Force overwrite existing site</label>
        </div>
      </div>
      <div class="row">
        <div class="col-4"><button id="launchBtn" class="primary">Launch Site (One Click)</button></div>
        <div class="col-4"><button id="createBtn" class="secondary">Create Only</button></div>
        <div class="col-4"><button id="statusBtn" class="secondary">Check Status</button></div>
      </div>
      <p id="status" class="status">Ready.</p>
    </section>
    <section class="panel">
      <h2>Result</h2>
      <pre id="out">Ready</pre>
    </section>
  </div>
  <script>
    const out = document.getElementById('out');
    const status = document.getElementById('status');

    function getValue(id) {
      const el = document.getElementById(id);
      if (!el) return '';
      if (el.type === 'checkbox') return Boolean(el.checked);
      return String(el.value || '').trim();
    }

    function setStatus(message, type) {
      status.textContent = message;
      status.className = 'status' + (type ? ' ' + type : '');
    }

    function buildPayload() {
      const payload = {
        siteSlug: getValue('siteSlug'),
        brandName: getValue('brandName') || undefined,
        locale: getValue('locale') || undefined,
        blueprint: getValue('blueprint') || undefined,
        businessMode: getValue('businessMode') || undefined,
        nichePreset: getValue('nichePreset') || undefined,
        themeTone: getValue('themeTone') || undefined,
        themeRecipe: getValue('themeRecipe') || undefined,
        topicCount: Number(getValue('topicCount') || 60),
        topicSource: getValue('topicSource') || 'suggest',
        topicStatus: getValue('topicStatus') || 'brief_ready',
        applySanity: Boolean(getValue('applySanity')),
        runPrepopulate: Boolean(getValue('runPrepopulate')),
        replaceTopics: Boolean(getValue('replaceTopics')),
        prepopulateTargetPublishedCount: Number(getValue('prepopulateTargetPublishedCount') || 30),
        prepopulateBatchSize: Number(getValue('prepopulateBatchSize') || 3),
        force: Boolean(getValue('force'))
      };
      if (!payload.themeRecipe) delete payload.themeRecipe;
      if (!payload.nichePreset) delete payload.nichePreset;
      if (!payload.brandName) delete payload.brandName;
      if (!payload.locale) delete payload.locale;
      return payload;
    }

    async function callApi(path, payload) {
      setStatus('Running...', '');
      out.textContent = 'Running...';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      out.textContent = text;
      if (res.ok) {
        setStatus('Completed.', 'ok');
      } else {
        setStatus('Failed. Check output.', 'err');
      }
    }

    document.getElementById('launchBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const payload = buildPayload();
      if (!payload.siteSlug) {
        setStatus('siteSlug is required.', 'err');
        return;
      }
      await callApi('/api/factory/site/launch', payload);
    });

    document.getElementById('createBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const payload = buildPayload();
      if (!payload.siteSlug) {
        setStatus('siteSlug is required.', 'err');
        return;
      }
      payload.applyCmsMutations = payload.applySanity;
      await callApi('/api/factory/site/create', payload);
    });

    document.getElementById('statusBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      const siteSlug = getValue('siteSlug');
      if (!siteSlug) {
        setStatus('siteSlug is required.', 'err');
        return;
      }
      setStatus('Loading status...', '');
      const res = await fetch('/api/factory/site/' + encodeURIComponent(siteSlug) + '/status');
      const text = await res.text();
      out.textContent = text;
      setStatus(res.ok ? 'Status loaded.' : 'Status request failed.', res.ok ? 'ok' : 'err');
    });

    (async () => {
      try {
        const res = await fetch('/api/factory/options');
        if (!res.ok) return;
        const data = await res.json();
        const nicheSelect = document.getElementById('nichePreset');
        if (nicheSelect && Array.isArray(data.nichePresets)) {
          nicheSelect.innerHTML = '<option value="">(none)</option>';
          for (const preset of data.nichePresets) {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.id + ' - ' + preset.label;
            nicheSelect.appendChild(option);
          }
        }
      } catch {}
    })();
  </script>
</body>
</html>`;
  return reply.type('text/html').send(html);
});

const port = Number(process.env.ENGINE_PORT || 8787);
const host = process.env.ENGINE_HOST || '0.0.0.0';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
