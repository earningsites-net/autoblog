import groq from 'groq';
import { articles as mockArticles, mockCategories } from './mock-data';
import { hasSanityConfig, sanityClient } from './sanity';
import { siteConfig } from './site';
import type { Article, Category } from './types';

export type ContentRepositoryDriver = 'auto' | 'mock' | 'sanity';

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
  author->{_id, name, role, bio},
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

const siteSlug = siteConfig.slug;

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
        groq`*[_type == "article" && siteSlug == $siteSlug && status == "published"] | order(publishedAt desc) ${articleProjection}`,
        { siteSlug }
      );
      return data?.length ? data.map(normalizeArticle) : [];
    } catch {
      return [];
    }
  }

  async getAllCategories() {
    const data = await this.fetchSanity<Category[]>(groq`*[_type == "category" && siteSlug == $siteSlug] | order(title asc) {
      _id,
      title,
      "slug": slug.current,
      description,
      accent
    }`, { siteSlug });
    return data?.length ? data : [];
  }
}

const mockRepository = new MockContentRepository();
const sanityRepository = new SanityContentRepository();

function resolveDriver(): ContentRepositoryDriver {
  const driver = (process.env.CONTENT_REPOSITORY_DRIVER || 'auto').toLowerCase();
  if (driver === 'mock' || driver === 'sanity' || driver === 'auto') {
    return driver;
  }
  return 'auto';
}

export function getContentRepository(): ContentRepository {
  const driver = resolveDriver();
  const isProduction = process.env.NODE_ENV === 'production';

  if (driver === 'mock') return mockRepository;
  if (driver === 'sanity') return sanityRepository;

  if (hasSanityConfig) return sanityRepository;
  if (isProduction) {
    throw new Error(
      'No content repository configured for production. Set Sanity envs or choose CONTENT_REPOSITORY_DRIVER explicitly.'
    );
  }
  return mockRepository;
}
