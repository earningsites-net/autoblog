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

type Props = {
  params: Promise<{ slug: string }>;
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
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const internalLinks = Array.isArray(article.internalLinks) ? article.internalLinks : [];
  const faqItems = Array.isArray(article.faqItems) ? article.faqItems : [];

  const related = await getRelatedArticles(article, 3);
  const breadcrumb = breadcrumbJsonLd([
    { name: 'Home', item: absoluteUrl('/') },
    { name: article.category.title, item: absoluteUrl(`/categories/${article.category.slug}`) },
    { name: article.title, item: absoluteUrl(`/articles/${article.slug}`) }
  ]);
  const faqLd = faqJsonLd(faqItems);

  return (
    <div className="space-y-10 py-6">
      <JsonLd data={articleJsonLd(article)} />
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqLd} />

      <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <header className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-card sm:p-8">
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink/60">
              <Link href={`/categories/${article.category.slug}`} className="rounded-full bg-paper px-3 py-1 font-semibold uppercase tracking-[0.14em] text-ink hover:text-rust">
                {article.category.title}
              </Link>
              <span>{formatDate(article.publishedAt)}</span>
              <span aria-hidden>•</span>
              <span>{article.readTimeMinutes} min read</span>
              <span aria-hidden>•</span>
              <span>QA {article.qaScore}</span>
            </div>
            <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">{article.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-ink/75">{article.excerpt}</p>
            <div className="mt-6 relative aspect-[16/9] overflow-hidden rounded-3xl">
              <Image src={article.coverImage} alt={article.coverImageAlt} fill className="object-cover" sizes="100vw" priority />
            </div>
          </header>

          <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-card sm:p-8">
            <PortableContent blocks={article.body} />

            <div className="mt-10 rounded-2xl border border-black/5 bg-paper p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Safety & Scope</p>
              <p className="mt-2 text-sm leading-6 text-ink/75">
                {article.disclaimerVariant === 'safety'
                  ? 'This article provides general informational guidance. For hazardous tools, structural changes, or complex repairs, consult a qualified professional.'
                  : 'This article is for general informational purposes and does not replace professional advice for complex repairs or installations.'}
              </p>
            </div>

            <FAQList items={faqItems} />
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <AdSlot name="Article Sidebar Top" minHeight={280} />

          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Internal Links</p>
            <h2 className="mt-2 font-display text-xl text-ink">Related reading</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {internalLinks.map((link) => (
                <li key={link.slug}>
                  <Link href={`/articles/${link.slug}`} className="text-ink/80 hover:text-rust">
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {tags.length > 0 ? (
            <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag._id} className="rounded-full border border-black/10 bg-paper px-3 py-1 text-xs text-ink/70">
                    {tag.title}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </article>

      <AdSlot name="Article In-feed Bottom" minHeight={180} />

      {related.length > 0 ? (
        <section className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">More in {article.category.title}</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Keep exploring</h2>
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
