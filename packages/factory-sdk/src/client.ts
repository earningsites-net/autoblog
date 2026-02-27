import type { GenerationJobRequest, GenerationJobResult, HealthStatus } from './types';

export type EngineApiClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export class EngineApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: EngineApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('content-type', 'application/json');
    if (this.apiKey) headers.set('x-engine-api-key', this.apiKey);

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Engine API ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  generate(stagePath: 'topics' | 'brief' | 'articles' | 'images' | 'qa', request: GenerationJobRequest) {
    return this.request<GenerationJobResult>(`/v1/generation/${stagePath}`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  publish(request: GenerationJobRequest) {
    return this.request<GenerationJobResult>('/v1/publish', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  runPipeline(request: GenerationJobRequest) {
    return this.request<GenerationJobResult>('/v1/pipelines/run', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  getJob(jobId: string) {
    return this.request<GenerationJobResult>(`/v1/jobs/${jobId}`);
  }

  getSiteHealth(siteSlug: string) {
    return this.request<HealthStatus>(`/v1/sites/${siteSlug}/health`);
  }
}
