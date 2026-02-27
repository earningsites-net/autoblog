import type { GenerationJobResult } from '@autoblog/factory-sdk';

export class InMemoryJobStore {
  private readonly jobs = new Map<string, GenerationJobResult>();

  set(job: GenerationJobResult) {
    this.jobs.set(job.jobId, job);
  }

  get(jobId: string) {
    return this.jobs.get(jobId) ?? null;
  }

  list() {
    return [...this.jobs.values()];
  }
}
