import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdSlot } from '@web/components/ad-slot';
import { ArticleCard } from '@web/components/article-card';
import { FAQList } from '@web/components/faq-list';
import { JsonLd } from '@web/components/json-ld';
import { PortableContent } from '@web/components/portable-content';
import { getAllArticleSlugs, getArticleBySlug, getRelatedArticles } from '@web/lib/content';
import { absoluteUrl, formatDate } from '@web/lib/site';
import { articleJsonLd, articleMetadata, breadcrumbJsonLd, faqJsonLd } from '@web/lib/seo';
import { getActiveSiteTheme } from '@web/lib/theme';

type Props = {
  params: Promise<{ slug: string }>;
};

type LightArticleStyles = {
  headerClass: string;
  contentClass: string;
  sidebarPanelClass: string;
  categoryPillClass: string;
  disclaimerClass: string;
  internalLinkClass: string;
  tagPillClass: string;
  coverImageFrameClass: string;
  accentLabelClass: string;
};

const DEFAULT_LIGHT_ARTICLE_STYLE: LightArticleStyles = {
  headerClass: 'rounded-[2rem] border border-black/5 bg-white p-6 shadow-card sm:p-8',
  contentClass: 'rounded-[2rem] border border-black/5 bg-white p-6 shadow-card sm:p-8',
  sidebarPanelClass: 'rounded-3xl border border-black/5 bg-white p-5 shadow-card',
  categoryPillClass: 'rounded-full bg-paper px-3 py-1 font-semibold uppercase tracking-[0.14em] text-ink hover:text-rust',
  disclaimerClass: 'mt-10 rounded-2xl border border-black/5 bg-paper p-5',
  internalLinkClass: 'text-ink/80 hover:text-rust',
  tagPillClass: 'rounded-full border border-black/10 bg-paper px-3 py-1 text-xs text-ink/70',
  coverImageFrameClass: 'mt-6 relative aspect-[16/9] overflow-hidden rounded-3xl',
  accentLabelClass: 'text-rust'
};

const LIGHT_ARTICLE_STYLES: Record<string, LightArticleStyles> = {
  default: DEFAULT_LIGHT_ARTICLE_STYLE,
  editorial_luxury: {
    headerClass: 'border border-black/5 bg-white p-6 shadow-card sm:p-8',
    contentClass: 'border border-black/5 bg-white p-6 shadow-card sm:p-8',
    sidebarPanelClass: 'border border-black/5 bg-white p-5 shadow-card',
    categoryPillClass: 'border border-black/15 bg-paper px-3 py-1 font-semibold uppercase tracking-[0.14em] text-ink hover:text-rust',
    disclaimerClass: 'mt-10 border border-black/5 bg-paper p-5',
    internalLinkClass: 'text-ink/80 hover:text-rust',
    tagPillClass: 'border border-black/10 bg-paper px-3 py-1 text-xs text-ink/70',
    coverImageFrameClass: 'mt-6 relative aspect-[16/9] overflow-hidden',
    accentLabelClass: 'text-rust'
  },
  warm_wellness: {
    headerClass: 'rounded-xl border border-rose-200 bg-white p-6 shadow-card sm:p-8',
    contentClass: 'rounded-xl border border-rose-200 bg-white p-6 shadow-card sm:p-8',
    sidebarPanelClass: 'rounded-xl border border-rose-200 bg-white p-5 shadow-card',
    categoryPillClass:
      'rounded-lg border border-rose-300 bg-rose-50 px-3 py-1 font-semibold uppercase tracking-[0.14em] text-ink hover:text-rose-500',
    disclaimerClass: 'mt-10 rounded-xl border border-rose-200 bg-rose-50/65 p-5',
    internalLinkClass: 'text-ink/80 hover:text-rose-500',
    tagPillClass: 'rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-ink/75',
    coverImageFrameClass: 'mt-6 relative aspect-[16/9] overflow-hidden rounded-xl',
    accentLabelClass: 'text-rose-500'
  }
};

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  return articleMetadata(article);
}

export default async function ArticlePage({ params }: Props) {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isDark = theme.isDark;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const internalLinks = Array.isArray(article.internalLinks) ? article.internalLinks : [];
  const faqItems = Array.isArray(article.faqItems) ? article.faqItems : [];

  const related = await getRelatedArticles(article, 3);
  const sidebarLinks = Array.from(
    new Map(
      [
        ...internalLinks.map((link) => [link.slug, link] as const),
        ...related.map((candidate) => [candidate.slug, { slug: candidate.slug, title: candidate.title }] as const)
      ].filter(([candidateSlug]) => Boolean(candidateSlug) && candidateSlug !== article.slug)
    ).values()
  ).slice(0, 4);
  const lightStyles: LightArticleStyles = LIGHT_ARTICLE_STYLES[recipe] || DEFAULT_LIGHT_ARTICLE_STYLE;
  const breadcrumb = breadcrumbJsonLd([
    { name: 'Home', item: absoluteUrl('/') },
    { name: article.category.title, item: absoluteUrl(`/categories/${article.category.slug}`) },
    { name: article.title, item: absoluteUrl(`/articles/${article.slug}`) }
  ]);
  const faqLd = faqJsonLd(faqItems);
  const authorMeta = article.author
    ? [article.author.name, article.author.role].filter(Boolean).join(' • ')
    : '';
  const headerClass = isDark
    ? isNoirSharp
      ? 'border border-white/15 bg-coal/78 p-6 shadow-[0_22px_58px_-32px_rgba(0,0,0,0.74)] sm:p-8'
      : isArcadeSoft
        ? 'rounded-xl border border-white/15 bg-coal/78 p-6 shadow-[0_22px_58px_-32px_rgba(0,0,0,0.74)] sm:p-8'
        : 'rounded-[2rem] border border-white/15 bg-coal/78 p-6 shadow-[0_22px_58px_-32px_rgba(0,0,0,0.74)] sm:p-8'
    : lightStyles.headerClass;
  const contentClass = isDark
    ? isNoirSharp
      ? 'border border-white/15 bg-coal/78 p-6 shadow-[0_22px_58px_-32px_rgba(0,0,0,0.74)] sm:p-8'
      : isArcadeSoft
        ? 'rounded-xl border border-white/15 bg-coal/78 p-6 shadow-[0_22px_58px_-32px_rgba(0,0,0,0.74)] sm:p-8'
        : 'rounded-[2rem] border border-white/15 bg-coal/78 p-6 shadow-[0_22px_58px_-32px_rgba(0,0,0,0.74)] sm:p-8'
    : lightStyles.contentClass;
  const sidebarPanelClass = isDark
    ? isNoirSharp
      ? 'border border-white/15 bg-coal/78 p-5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.74)]'
      : isArcadeSoft
        ? 'rounded-xl border border-white/15 bg-coal/78 p-5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.74)]'
        : 'rounded-3xl border border-white/15 bg-coal/78 p-5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.74)]'
    : lightStyles.sidebarPanelClass;
  const metaClass = isDark ? 'flex flex-wrap items-center gap-3 text-xs text-paper/68' : 'flex flex-wrap items-center gap-3 text-xs text-ink/60';
  const categoryPillClass = isDark
    ? isNoirSharp
      ? 'border border-white/20 bg-black/30 px-3 py-1 font-semibold uppercase tracking-[0.14em] text-paper hover:text-rust'
      : isArcadeSoft
        ? 'rounded-lg border border-white/20 bg-black/30 px-3 py-1 font-semibold uppercase tracking-[0.14em] text-paper hover:text-rust'
        : 'rounded-full border border-white/20 bg-black/30 px-3 py-1 font-semibold uppercase tracking-[0.14em] text-paper hover:text-rust'
    : lightStyles.categoryPillClass;
  const excerptClass = isDark ? 'mt-4 max-w-3xl text-base leading-7 text-paper/78' : 'mt-4 max-w-3xl text-base leading-7 text-ink/75';
  const disclaimerClass = isDark
    ? isNoirSharp
      ? 'mt-10 border border-white/12 bg-black/25 p-5'
      : isArcadeSoft
        ? 'mt-10 rounded-xl border border-white/12 bg-black/25 p-5'
        : 'mt-10 rounded-2xl border border-white/12 bg-black/25 p-5'
    : lightStyles.disclaimerClass;
  const disclaimerTextClass = isDark ? 'mt-2 text-sm leading-6 text-paper/76' : 'mt-2 text-sm leading-6 text-ink/75';
  const internalLinkClass = isDark ? 'text-paper/82 hover:text-rust' : lightStyles.internalLinkClass;
  const tagPillClass = isDark
    ? isNoirSharp
      ? 'border border-white/20 bg-black/25 px-3 py-1 text-xs text-paper/75'
      : isArcadeSoft
        ? 'rounded-lg border border-white/20 bg-black/25 px-3 py-1 text-xs text-paper/75'
        : 'rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs text-paper/75'
    : lightStyles.tagPillClass;
  const keepExploringClass = isDark ? 'mt-2 font-display text-3xl text-paper' : 'mt-2 font-display text-3xl text-ink';
  const accentLabelClass = isDark ? 'text-rust' : lightStyles.accentLabelClass;
  const coverImageFrameClass = isDark
    ? isNoirSharp
      ? 'mt-6 relative aspect-[16/9] overflow-hidden'
      : isArcadeSoft
        ? 'mt-6 relative aspect-[16/9] overflow-hidden rounded-xl'
        : 'mt-6 relative aspect-[16/9] overflow-hidden rounded-3xl'
    : lightStyles.coverImageFrameClass;

  return (
    <div className="space-y-10 py-6">
      <JsonLd data={articleJsonLd(article)} />
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqLd} />

      <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <header className={headerClass}>
            <div className={metaClass}>
              <Link href={`/categories/${article.category.slug}`} className={categoryPillClass}>
                {article.category.title}
              </Link>
              {authorMeta ? <span>{authorMeta}</span> : null}
              {authorMeta ? <span aria-hidden>•</span> : null}
              <span>{formatDate(article.publishedAt)}</span>
              <span aria-hidden>•</span>
              <span>{article.readTimeMinutes} min read</span>
              <span aria-hidden>•</span>
              <span>QA {article.qaScore}</span>
            </div>
            <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">{article.title}</h1>
            <p className={excerptClass}>{article.excerpt}</p>
            {article.author?.bio ? (
              <p className={isDark ? 'mt-4 max-w-3xl text-sm leading-6 text-paper/72' : 'mt-4 max-w-3xl text-sm leading-6 text-ink/68'}>
                {article.author.bio}
              </p>
            ) : null}
            <div className={coverImageFrameClass}>
              <Image src={article.coverImage} alt={article.coverImageAlt} fill className="object-cover" sizes="100vw" priority />
            </div>
          </header>

          <div className={contentClass}>
            <PortableContent blocks={article.body} />

            <div className={disclaimerClass}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentLabelClass}`}>Safety & Scope</p>
              <p className={disclaimerTextClass}>
                {article.disclaimerVariant === 'safety'
                  ? 'This article provides general informational guidance. For hazardous tools, structural changes, or complex repairs, consult a qualified professional.'
                  : 'This article is for general informational purposes and does not replace professional advice for complex repairs or installations.'}
              </p>
            </div>

            <FAQList items={faqItems} />
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <AdSlot name="Article Sidebar Top" minHeight={280} slotKey="header" />

          <section className={sidebarPanelClass}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentLabelClass}`}>More to explore</p>
            <h2 className="mt-2 font-display text-xl text-ink">Read next</h2>
            {sidebarLinks.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm">
                {sidebarLinks.map((link) => (
                  <li key={link.slug}>
                    <Link href={`/articles/${link.slug}`} className={internalLinkClass}>
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-ink/70">More related articles will appear here as soon as the site has a larger published library.</p>
            )}
          </section>

          {tags.length > 0 ? (
            <section className={sidebarPanelClass}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentLabelClass}`}>Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag._id} className={tagPillClass}>
                    {tag.title}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </article>

      <AdSlot name="Article In-feed Bottom" minHeight={180} slotKey="footer" />

      {related.length > 0 ? (
        <section className="space-y-5">
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentLabelClass}`}>More in {article.category.title}</p>
            <h2 className={keepExploringClass}>Keep exploring</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {related.map((candidate) => (
              <ArticleCard key={candidate._id} article={candidate} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
