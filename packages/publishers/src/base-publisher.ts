import type {
  ArticleDraftInput,
  GenerationRunInput,
  HeroImageAttachmentInput,
  Publisher,
  QaLogInput,
  SiteBlueprint,
  TopicCandidateInput
} from '@autoblog/factory-sdk';

export abstract class BaseStubPublisher implements Publisher {
  abstract readonly kind: string;

  protected createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  async upsertTopicCandidate(_site: SiteBlueprint, _input: TopicCandidateInput) {
    return { id: this.createId('topic') };
  }

  async upsertArticleDraft(_site: SiteBlueprint, input: ArticleDraftInput) {
    const slug = typeof input.slug === 'string' ? input.slug : undefined;
    return { id: this.createId('article'), slug };
  }

  async attachHeroImage(_site: SiteBlueprint, input: HeroImageAttachmentInput) {
    return {
      articleId: String(input.articleId ?? this.createId('article')),
      assetUrl: typeof input.assetUrl === 'string' ? input.assetUrl : undefined
    };
  }

  async publishArticle(_site: SiteBlueprint, input: { articleId: string }) {
    return {
      articleId: input.articleId,
      publishedAt: new Date().toISOString()
    };
  }

  async writeQaLog(_site: SiteBlueprint, _input: QaLogInput) {
    return { id: this.createId('qalog') };
  }

  async writeGenerationRun(_site: SiteBlueprint, _input: GenerationRunInput) {
    return { id: this.createId('genrun') };
  }

  async listPublishedArticles(_site: SiteBlueprint) {
    return [];
  }
}
