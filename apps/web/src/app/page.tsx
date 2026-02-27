import Link from 'next/link';
import { MagazineHero } from '@web/components/magazine-hero';
import { ArticleCard } from '@web/components/article-card';
import { CategoryGrid } from '@web/components/category-grid';
import { AdSlot } from '@web/components/ad-slot';
import { PageHero } from '@web/components/page-hero';
import { getAllCategories, getFeaturedArticles, getPublishedArticles } from '@web/lib/content';
import { siteConfig } from '@web/lib/site';

export default async function HomePage() {
  const [featured, articles, categories] = await Promise.all([
    getFeaturedArticles(),
    getPublishedArticles(),
    getAllCategories()
  ]);

  const latest = articles.slice(0, 6);

  return (
    <div className="space-y-10 py-6">
      <PageHero
        eyebrow="AI Editorial Engine"
        title={`A premium ${siteConfig.niche} content site built for automated publishing`}
        description="Magazine-style presentation, SEO-first page structure, and n8n-ready publishing workflows for low-touch growth and future ad monetization."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/categories" className="inline-flex rounded-full bg-coal px-5 py-3 text-sm font-medium text-paper hover:bg-coal/90">
              Explore categories
            </Link>
            <Link href="/about" className="inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-ink hover:border-black/20">
              How the site works
            </Link>
          </div>
        }
      />

      <MagazineHero articles={featured} />

      <AdSlot name="Home Hero In-feed" minHeight={180} />

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Latest</p>
            <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">Fresh evergreen guides</h2>
          </div>
          <Link href="/categories" className="text-sm font-medium text-ink hover:text-rust">
            View all categories →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {latest.map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Topical Clusters</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{`Built for scalable ${siteConfig.niche} publishing`}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/75">
            Categories are structured for evergreen coverage, internal linking, and automated article routing via CMS and n8n workflows.
          </p>
        </div>
        <CategoryGrid categories={categories} />
      </section>

      <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Operational Note</p>
            <h2 className="mt-2 font-display text-2xl text-ink">Budget-aware automation mode</h2>
            <p className="mt-3 text-sm leading-6 text-ink/75">
              The publishing engine is designed for 20+ topic candidates/day, but the initial publish quota is throttled to preserve sub-$100 monthly operating cost.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-paper px-4 py-3">
              <p className="text-ink/60">Target quota</p>
              <p className="font-display text-xl text-ink">4-8/day</p>
            </div>
            <div className="rounded-2xl bg-paper px-4 py-3">
              <p className="text-ink/60">Locale</p>
              <p className="font-display text-xl text-ink">{siteConfig.locale}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
