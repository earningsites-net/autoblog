import groq from 'groq';
import { articles as mockArticles, mockCategories } from './mock-data';
import { hasSanityConfig, sanityClient } from './sanity';
import { getSiteBlueprint } from './site-blueprint';
import type { Article, Category } from './types';

export type ContentRepositoryDriver = 'auto' | 'mock' | 'sanity' | 'api';

export interface ContentRepository {
  driver: ContentRepositoryDriver;
  getPublishedArticles(): Promise<Article[]>;
  getAllCategories(): Promise<Category[]>;
}

const articleProjection = groq`{
  _id,
  title,
  "slug": slug.current,
  excerpt,
  "coverImage": coverImage.asset->url,
  coverImageAlt,
  category->{_id, title, "slug": slug.current, description, accent},
  "tags": tags[]->{_id, title, "slug": slug.current},
  body,
  faqItems,
  seoTitle,
  seoDescription,
  canonicalUrl,
  publishedAt,
  status,
  qaScore,
  qaFlags,
  readTimeMinutes,
  internalLinks[]{title, slug},
  disclaimerVariant
}`;

function normalizeArticle(article: Article): Article {
  return {
    ...article,
    tags: Array.isArray(article.tags) ? article.tags.filter(Boolean) : [],
    body: Array.isArray(article.body) ? article.body.filter(Boolean) : [],
    faqItems: Array.isArray(article.faqItems) ? article.faqItems.filter(Boolean) : [],
    qaFlags: Array.isArray(article.qaFlags) ? article.qaFlags.filter(Boolean) : [],
    internalLinks: Array.isArray(article.internalLinks)
      ? article.internalLinks.filter((link) => Boolean(link?.slug && link?.title))
      : []
  };
}

class MockContentRepository implements ContentRepository {
  driver: ContentRepositoryDriver = 'mock';

  async getPublishedArticles() {
    return mockArticles;
  }

  async getAllCategories() {
    return mockCategories;
  }
}

class SanityContentRepository implements ContentRepository {
  driver: ContentRepositoryDriver = 'sanity';

  private async fetchSanity<T>(query: string, params?: Record<string, unknown>) {
    if (!sanityClient) throw new Error('Sanity client not configured');
    return sanityClient.fetch<T>(query, params ?? {}, { next: { revalidate: 300 } });
  }

  async getPublishedArticles() {
    try {
      const data = await this.fetchSanity<Article[]>(
        groq`*[_type == "article" && status == "published"] | order(publishedAt desc) ${articleProjection}`
      );
      return data?.length ? data.map(normalizeArticle) : mockArticles;
    } catch {
      return mockArticles;
    }
  }

  async getAllCategories() {
    try {
      const data = await this.fetchSanity<Category[]>(groq`*[_type == "category"] | order(title asc) {
        _id,
        title,
        "slug": slug.current,
        description,
        accent
      }`);
      return data?.length ? data : mockCategories;
    } catch {
      return mockCategories;
    }
  }
}

class ApiContentRepository implements ContentRepository {
  driver: ContentRepositoryDriver = 'api';
  private readonly baseUrl = (process.env.CONTENT_API_BASE_URL || process.env.CONTENT_ENGINE_URL || '').replace(/\/$/, '');

  async getPublishedArticles() {
    if (!this.baseUrl) return mockArticles;

    try {
      const blueprint = getSiteBlueprint();
      const siteSlug = blueprint?.siteSlug || 'default';
      const res = await fetch(`${this.baseUrl}/v1/content/articles?siteSlug=${encodeURIComponent(siteSlug)}`, {
        next: { revalidate: 300 }
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as { items?: Article[] };
      return json.items?.length ? json.items.map(normalizeArticle) : mockArticles;
    } catch {
      return mockArticles;
    }
  }

  async getAllCategories() {
    if (!this.baseUrl) return mockCategories;

    try {
      const blueprint = getSiteBlueprint();
      const siteSlug = blueprint?.siteSlug || 'default';
      const res = await fetch(`${this.baseUrl}/v1/content/categories?siteSlug=${encodeURIComponent(siteSlug)}`, {
        next: { revalidate: 300 }
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as { items?: Category[] };
      return json.items?.length ? json.items : mockCategories;
    } catch {
      return mockCategories;
    }
  }
}

const mockRepository = new MockContentRepository();
const sanityRepository = new SanityContentRepository();
const apiRepository = new ApiContentRepository();

function resolveDriver(): ContentRepositoryDriver {
  const driver = (process.env.CONTENT_REPOSITORY_DRIVER || 'auto').toLowerCase();
  if (driver === 'mock' || driver === 'sanity' || driver === 'api' || driver === 'auto') {
    return driver;
  }
  return 'auto';
}

export function getContentRepository(): ContentRepository {
  const driver = resolveDriver();

  if (driver === 'mock') return mockRepository;
  if (driver === 'sanity') return hasSanityConfig ? sanityRepository : mockRepository;
  if (driver === 'api') return apiRepository;

  if (hasSanityConfig) return sanityRepository;
  if (process.env.CONTENT_API_BASE_URL || process.env.CONTENT_ENGINE_URL) return apiRepository;
  return mockRepository;
}
