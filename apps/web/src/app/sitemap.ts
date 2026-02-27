import type { MetadataRoute } from 'next';
import { getAllCategories, getPublishedArticles } from '@web/lib/content';
import { absoluteUrl } from '@web/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories] = await Promise.all([getPublishedArticles(), getAllCategories()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/categories'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl('/contact'), changeFrequency: 'monthly', priority: 0.3 },
    { url: absoluteUrl('/privacy-policy'), changeFrequency: 'monthly', priority: 0.2 },
    { url: absoluteUrl('/cookie-policy'), changeFrequency: 'monthly', priority: 0.2 },
    { url: absoluteUrl('/disclaimer'), changeFrequency: 'monthly', priority: 0.2 }
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: absoluteUrl(`/categories/${category.slug}`),
    changeFrequency: 'daily',
    priority: 0.8
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: absoluteUrl(`/articles/${article.slug}`),
    lastModified: new Date(article.publishedAt),
    changeFrequency: 'weekly',
    priority: 0.7
  }));

  return [...staticPages, ...categoryPages, ...articlePages];
}
