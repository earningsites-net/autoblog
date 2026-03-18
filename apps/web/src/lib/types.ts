export type ArticleStatus = 'draft' | 'ready_to_publish' | 'published' | 'rejected_auto';
export type BudgetMode = 'normal' | 'economy' | 'throttle' | 'stop';

export type TextBlock = {
  _key: string;
  _type: 'block';
  style?: 'normal' | 'h2' | 'h3' | 'h4';
  listItem?: 'bullet' | 'number';
  children: Array<{ _key: string; _type: 'span'; text: string; marks?: string[] }>;
  markDefs?: Array<{ _key: string; _type: string; href?: string; nofollow?: boolean }>;
};

export type FAQItem = {
  question: string;
  answer: string;
};

export type Category = {
  _id: string;
  title: string;
  slug: string;
  description: string;
  accent: string;
};

export type Tag = {
  _id: string;
  title: string;
  slug: string;
};

export type AuthorProfile = {
  _id: string;
  name: string;
  role: string;
  bio: string;
};

export type Article = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  coverImageAlt: string;
  category: Category;
  author?: AuthorProfile;
  tags: Tag[];
  body: TextBlock[];
  faqItems: FAQItem[];
  seoTitle: string;
  seoDescription: string;
  canonicalUrl?: string;
  qaPassedAt?: string;
  publishScheduledAt?: string;
  publishedAt: string;
  status: ArticleStatus;
  qaScore: number;
  qaFlags: string[];
  readTimeMinutes: number;
  internalLinks: Array<{ slug: string; title: string }>;
  disclaimerVariant: 'general' | 'safety';
  pipelineMode?: 'prepopulate_bulk_direct' | 'steady_scheduled';
  prepopulateBatchId?: string;
  publishSequence?: number;
};

export type TopicCandidate = {
  _id: string;
  query: string;
  searchIntent: 'informational';
  evergreenScore: number;
  riskScore: number;
  templateType: 'how-to' | 'list' | 'tips' | 'checklist';
  status: 'queued' | 'brief_ready' | 'generated' | 'skipped';
  targetKeyword: string;
  supportingKeywords: string[];
  whyNow?: string;
};

export type QAResult = {
  score: number;
  flags: string[];
};
