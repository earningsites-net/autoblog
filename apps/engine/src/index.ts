import path from 'node:path';
import Fastify from 'fastify';
import { generationJobRequestSchema } from '@autoblog/factory-sdk';
import { createWorkflowRunner } from './adapters/workflow-runners';
import { DefaultEngineService } from './services/engine-service';
import { InMemoryJobStore } from './services/job-store';
import { LocalSiteRegistry } from './services/site-registry';

const app = Fastify({ logger: true });

const workspaceRoot = process.env.WORKSPACE_ROOT || path.resolve(process.cwd(), '..', '..');
const siteRegistry = new LocalSiteRegistry(workspaceRoot);
const jobStore = new InMemoryJobStore();
const engine = new DefaultEngineService(siteRegistry, jobStore, createWorkflowRunner);

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

app.post('/v1/factory/sites', async (_req, reply) => {
  return reply.code(501).send({
    ok: false,
    error: 'Factory site provisioning API not implemented yet. Use the autoblog CLI (scripts/autoblog.mjs) for now.'
  });
});

app.post('/v1/factory/sites/:id/provision', async (_req, reply) => {
  return reply.code(501).send({ ok: false, error: 'Not implemented yet (CLI first)' });
});

app.post('/v1/factory/sites/:id/seed', async (_req, reply) => {
  return reply.code(501).send({ ok: false, error: 'Not implemented yet (CLI first)' });
});

app.post('/v1/factory/sites/:id/deploy', async (_req, reply) => {
  return reply.code(501).send({ ok: false, error: 'Not implemented yet (CLI first)' });
});

app.post('/v1/factory/sites/:id/export-handoff', async (_req, reply) => {
  return reply.code(501).send({ ok: false, error: 'Not implemented yet (CLI first)' });
});

const port = Number(process.env.ENGINE_PORT || 8787);
const host = process.env.ENGINE_HOST || '0.0.0.0';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
