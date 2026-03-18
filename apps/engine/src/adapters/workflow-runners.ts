import type { GenerationJobRequest, GenerationJobResult, WorkflowRunner } from '@autoblog/factory-sdk';

function makeBaseResult(request: GenerationJobRequest): GenerationJobResult {
  return {
    jobId: crypto.randomUUID(),
    siteSlug: request.siteSlug,
    stage: request.stage,
    status: 'running',
    startedAt: new Date().toISOString(),
    budgetMode: request.options?.budgetModeOverride ?? 'normal',
    costEstimateUsd: 0
  };
}

function deriveStubHeadline(request: GenerationJobRequest) {
  const input = (request.input && typeof request.input === 'object') ? (request.input as Record<string, unknown>) : {};
  return String(
    input.title ||
      input.query ||
      input.targetKeyword ||
      input.primaryNiche ||
      input.topic ||
      `${request.stage} editorial feature`
  )
    .trim()
    .slice(0, 140);
}

export class DirectEngineRunner implements WorkflowRunner {
  readonly kind = 'direct' as const;

  async run(request: GenerationJobRequest): Promise<GenerationJobResult> {
    const result = makeBaseResult(request);
    const simulatedOutput: Record<string, unknown> = {
      stage: request.stage,
      dryRun: Boolean(request.options?.dryRun),
      receivedInputKeys: Object.keys(request.input || {}),
      note: 'Direct runner stub. Replace with BullMQ/Temporal-backed execution for production.'
    };

    // Minimal stage-specific stub outputs to make the contract concrete.
    if (request.stage === 'topics') {
      const seedTopic = deriveStubHeadline(request) || 'editorial topic';
      simulatedOutput.items = [
        {
          query: seedTopic,
          targetKeyword: seedTopic.toLowerCase(),
          evergreenScore: 84,
          riskScore: 12,
          templateType: 'list',
          searchIntent: 'informational'
        }
      ];
      result.costEstimateUsd = 0.01;
    }

    if (request.stage === 'articles') {
      const headline = deriveStubHeadline(request) || 'Editorial feature';
      const slug = headline
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
      simulatedOutput.article = {
        title: headline,
        slug: slug || 'editorial-feature',
        excerpt: `A stub article summary for ${headline}. Replace the direct runner with a real workflow backend before relying on this output.`,
        seoTitle: headline,
        seoDescription: `A stub SEO description for ${headline}.`
      };
      result.costEstimateUsd = 0.06;
    }

    if (request.stage === 'images') {
      const headline = deriveStubHeadline(request) || 'editorial feature';
      simulatedOutput.image = {
        prompt: `Photorealistic editorial hero image for a professional digital magazine article. Primary subject: ${headline}. Use a scene aligned with the story. No logos, no text overlay, 16:9.`,
        aspectRatio: '16:9'
      };
      result.costEstimateUsd = 0.03;
    }

    if (request.stage === 'qa') {
      simulatedOutput.qa = {
        score: 86,
        flags: []
      };
      result.costEstimateUsd = 0.005;
    }

    if (request.stage === 'pipeline') {
      simulatedOutput.pipeline = {
        stages: ['topics', 'brief', 'articles', 'images', 'qa', 'publish'],
        summary: 'Pipeline stub executed via direct runner'
      };
      result.costEstimateUsd = 0.11;
    }

    result.status = 'completed';
    result.finishedAt = new Date().toISOString();
    result.output = simulatedOutput;
    return result;
  }
}

export class N8nWorkflowRunner implements WorkflowRunner {
  readonly kind = 'n8n' as const;

  constructor(private readonly baseUrl?: string, private readonly apiKey?: string) {}

  async run(request: GenerationJobRequest): Promise<GenerationJobResult> {
    const result = makeBaseResult(request);

    if (!this.baseUrl) {
      result.status = 'failed';
      result.finishedAt = new Date().toISOString();
      result.error = 'N8N runner not configured (missing base URL)';
      return result;
    }

    // Stub integration contract: call a generic webhook/endpoint in a real implementation.
    result.status = 'completed';
    result.finishedAt = new Date().toISOString();
    result.output = {
      forwardedTo: this.baseUrl,
      note: 'n8n adapter stub. Implement webhook routing/imported workflow trigger here.',
      requestPreview: {
        siteSlug: request.siteSlug,
        stage: request.stage
      }
    };
    result.costEstimateUsd = 0;
    return result;
  }
}

export function createWorkflowRunner(kind: 'direct' | 'n8n' | 'bullmq' = 'direct'): WorkflowRunner {
  switch (kind) {
    case 'n8n':
      return new N8nWorkflowRunner(process.env.N8N_API_BASE_URL, process.env.N8N_API_KEY);
    case 'bullmq':
      // Placeholder until the queue worker is introduced.
      return new DirectEngineRunner();
    case 'direct':
    default:
      return new DirectEngineRunner();
  }
}
