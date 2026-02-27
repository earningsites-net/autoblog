import { createPublisher } from '@autoblog/publishers';
import type {
  EngineService,
  GenerationJobRequest,
  GenerationJobResult,
  HealthStatus,
  SiteBlueprint,
  SiteRegistry,
  WorkflowRunner
} from '@autoblog/factory-sdk';
import { InMemoryJobStore } from './job-store';

export class DefaultEngineService implements EngineService {
  constructor(
    private readonly siteRegistry: SiteRegistry,
    private readonly jobStore: InMemoryJobStore,
    private readonly runnerFactory: (kind?: 'direct' | 'n8n' | 'bullmq') => WorkflowRunner
  ) {}

  async runStage(request: GenerationJobRequest): Promise<GenerationJobResult> {
    const site = await this.requireSite(request.siteSlug);
    const publisher = createPublisher(site);
    const runner = this.runnerFactory((request.options?.workflowRunner as 'direct' | 'n8n' | 'bullmq' | undefined) ?? 'direct');

    const result = await runner.run(request);
    this.jobStore.set(result);

    if (result.status === 'completed' && request.stage === 'publish' && !request.options?.dryRun) {
      await publisher.writeGenerationRun(site, {
        stage: request.stage,
        result,
        source: 'engine'
      });
    }

    return result;
  }

  async runPipeline(request: GenerationJobRequest): Promise<GenerationJobResult> {
    return this.runStage({ ...request, stage: 'pipeline' });
  }

  async getJob(jobId: string): Promise<GenerationJobResult | null> {
    return this.jobStore.get(jobId);
  }

  async health(siteSlug: string): Promise<HealthStatus> {
    const site = await this.siteRegistry.getSite(siteSlug);
    if (!site) {
      return {
        siteSlug,
        ok: false,
        publishingTarget: 'sanity',
        workflowRunner: 'direct',
        checks: [{ name: 'site_blueprint', ok: false, detail: 'Site blueprint not found' }]
      };
    }

    return {
      siteSlug,
      ok: true,
      publishingTarget: site.publishingTarget.kind,
      workflowRunner: (process.env.DEFAULT_WORKFLOW_RUNNER as 'direct' | 'n8n' | 'bullmq') || 'direct',
      checks: [
        { name: 'site_blueprint', ok: true },
        {
          name: 'publishing_target',
          ok: true,
          detail: site.publishingTarget.kind
        },
        {
          name: 'budget_policy',
          ok: site.budgetPolicy.monthlyCapUsd > 0,
          detail: `Cap $${site.budgetPolicy.monthlyCapUsd}/month`
        }
      ]
    };
  }

  private async requireSite(siteSlug: string): Promise<SiteBlueprint> {
    const site = await this.siteRegistry.getSite(siteSlug);
    if (!site) {
      throw new Error(`Unknown site: ${siteSlug}`);
    }
    return site;
  }
}
