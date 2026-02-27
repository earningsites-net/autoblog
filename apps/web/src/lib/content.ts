import { unstable_cache } from 'next/cache';
import { getContentRepository } from './content-repository';
import type { Article, Category } from './types';

const getPublishedArticlesCached = unstable_cache(
  async (): Promise<Article[]> => {
    const repository = getContentRepository();
    return repository.getPublishedArticles();
  },
  ['published-articles', process.env.CONTENT_REPOSITORY_DRIVER || 'auto'],
  { revalidate: 300 }
);

export async function getPublishedArticles() {
  return getPublishedArticlesCached();
}

export async function getFeaturedArticles() {
  const all = await getPublishedArticles();
  return all.slice(0, 5);
}

export async function getAllArticleSlugs() {
  const all = await getPublishedArticles();
  return all.map((article) => article.slug);
}

export async function getArticleBySlug(slug: string) {
  const all = await getPublishedArticles();
  return all.find((article) => article.slug === slug) ?? null;
}

export async function getAllCategories(): Promise<Category[]> {
  const repository = getContentRepository();
  return repository.getAllCategories();
}

export async function getAllCategorySlugs() {
  const categories = await getAllCategories();
  return categories.map((category) => category.slug);
}

export async function getCategoryBySlug(slug: string) {
  const categories = await getAllCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getCategoryArticles(slug: string) {
  const all = await getPublishedArticles();
  return all.filter((article) => article.category.slug === slug);
}

export async function getRelatedArticles(article: Article, limit = 3) {
  const all = await getPublishedArticles();
  const sameCategory = all.filter(
    (candidate) => candidate.slug !== article.slug && candidate.category.slug === article.category.slug
  );
  return sameCategory.length > 0
    ? sameCategory.slice(0, limit)
    : all.filter((candidate) => candidate.slug !== article.slug).slice(0, limit);
}

export type PaginatedCategoryResult = {
  items: Article[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
};

export function paginateArticles(
  items: Article[],
  pageParam: string | undefined,
  pageSize = 9
): PaginatedCategoryResult {
  const page = Math.max(1, Number.parseInt(pageParam || '1', 10) || 1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    total,
    pageSize
  };
}
