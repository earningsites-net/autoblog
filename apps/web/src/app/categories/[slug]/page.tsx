import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@web/components/article-card';
import { PageHero } from '@web/components/page-hero';
import { AdSlot } from '@web/components/ad-slot';
import {
  getAllCategorySlugs,
  getCategoryArticles,
  getCategoryBySlug,
  paginateArticles
} from '@web/lib/content';
import { absoluteUrl } from '@web/lib/site';
import { getActiveSiteTheme } from '@web/lib/theme';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};

  return {
    title: `${category.title} Guides`,
    description: category.description,
    alternates: {
      canonical: absoluteUrl(`/categories/${category.slug}`)
    }
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const theme = getActiveSiteTheme();
  const isDark = theme.isDark;
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const allArticles = await getCategoryArticles(slug);
  const pagination = paginateArticles(
    allArticles,
    Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page
  );
  const emptyStateClass = isDark
    ? 'rounded-3xl border border-white/15 bg-coal/80 p-8 shadow-[0_20px_52px_-32px_rgba(0,0,0,0.74)]'
    : 'rounded-3xl border border-black/5 bg-white p-8 shadow-card';
  const paginationBoxClass = isDark
    ? 'flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/15 bg-coal/80 p-4 shadow-[0_20px_52px_-32px_rgba(0,0,0,0.74)]'
    : 'flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-card';
  const paginationTextClass = isDark ? 'text-sm text-paper/75' : 'text-sm text-ink/70';
  const previousLinkClass = isDark
    ? 'rounded-full border border-white/25 px-4 py-2 text-paper hover:border-white/45'
    : 'rounded-full border border-black/10 px-4 py-2 hover:border-black/20';
  const nextLinkClass = isDark
    ? 'rounded-full bg-rust px-4 py-2 text-paper hover:bg-rust/90'
    : 'rounded-full bg-coal px-4 py-2 text-paper hover:bg-coal/90';

  return (
    <div className="space-y-8 py-6">
      <PageHero eyebrow="Category" title={category.title} description={category.description} />

      <AdSlot name={`Category Top - ${category.title}`} minHeight={160} />

      {pagination.items.length === 0 ? (
        <div className={emptyStateClass}>
          <p className="font-display text-2xl text-ink">No published guides yet</p>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            The automation pipeline can publish to this category as soon as topic candidates pass QA and image generation.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pagination.items.map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </div>
      )}

      <div className={paginationBoxClass}>
        <p className={paginationTextClass}>
          Page {pagination.page} of {pagination.pageCount} ({pagination.total} articles)
        </p>
        <div className="flex items-center gap-2 text-sm">
          {pagination.page > 1 ? (
            <Link
              href={`/categories/${category.slug}?page=${pagination.page - 1}`}
              className={previousLinkClass}
            >
              Previous
            </Link>
          ) : null}
          {pagination.page < pagination.pageCount ? (
            <Link
              href={`/categories/${category.slug}?page=${pagination.page + 1}`}
              className={nextLinkClass}
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
