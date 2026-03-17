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
      simulatedOutput.items = [
        {
          query: 'practical ai workflow examples',
          targetKeyword: 'ai workflow examples',
          evergreenScore: 84,
          riskScore: 12,
          templateType: 'list',
          searchIntent: 'informational'
        }
      ];
      result.costEstimateUsd = 0.01;
    }

    if (request.stage === 'articles') {
      simulatedOutput.article = {
        title: 'Practical AI Workflow Examples for Teams',
        slug: 'practical-ai-workflow-examples-for-teams',
        excerpt: 'Concrete ways teams can use AI workflows to improve speed, clarity, and execution.',
        seoTitle: 'Practical AI Workflow Examples for Teams',
        seoDescription: 'Useful examples of AI workflows that teams can adapt to real operational needs.'
      };
      result.costEstimateUsd = 0.06;
    }

    if (request.stage === 'images') {
      simulatedOutput.image = {
        prompt: 'Photorealistic editorial hero image for a professional digital magazine article, modern workspace scene, no logos, no text overlay, 16:9',
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
