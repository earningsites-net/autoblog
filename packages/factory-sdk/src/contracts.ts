import type {
  GenerationJobRequest,
  GenerationJobResult,
  HealthStatus,
  SiteBlueprint,
  WorkflowRunnerKind
} from './types';

export type TopicCandidateInput = Record<string, unknown>;
export type ArticleDraftInput = Record<string, unknown>;
export type HeroImageAttachmentInput = Record<string, unknown>;
export type QaLogInput = Record<string, unknown>;
export type GenerationRunInput = Record<string, unknown>;

export interface Publisher {
  readonly kind: string;
  upsertTopicCandidate(site: SiteBlueprint, input: TopicCandidateInput): Promise<{ id: string }>;
  upsertArticleDraft(site: SiteBlueprint, input: ArticleDraftInput): Promise<{ id: string; slug?: string }>;
  attachHeroImage(site: SiteBlueprint, input: HeroImageAttachmentInput): Promise<{ articleId: string; assetUrl?: string }>;
  publishArticle(site: SiteBlueprint, input: { articleId: string; slug?: string; qaScore?: number; qaFlags?: string[] }): Promise<{ articleId: string; publishedAt: string }>;
  writeQaLog(site: SiteBlueprint, input: QaLogInput): Promise<{ id: string }>;
  writeGenerationRun(site: SiteBlueprint, input: GenerationRunInput): Promise<{ id: string }>;
  listPublishedArticles(site: SiteBlueprint): Promise<Array<Record<string, unknown>>>;
}

export interface WorkflowRunner {
  readonly kind: WorkflowRunnerKind;
  run(request: GenerationJobRequest): Promise<GenerationJobResult>;
}

export interface SiteRegistry {
  listSites(): Promise<SiteBlueprint[]>;
  getSite(siteSlug: string): Promise<SiteBlueprint | null>;
}

export interface EngineService {
  runStage(request: GenerationJobRequest): Promise<GenerationJobResult>;
  runPipeline(request: GenerationJobRequest): Promise<GenerationJobResult>;
  getJob(jobId: string): Promise<GenerationJobResult | null>;
  health(siteSlug: string): Promise<HealthStatus>;
}
