import Link from 'next/link';
import { MagazineHero } from '@web/components/magazine-hero';
import { ArticleCard } from '@web/components/article-card';
import { ArticleCarouselColumns } from '@web/components/article-carousel-columns';
import { LatestDuoSection } from '@web/components/latest-duo-section';
import { CategoryGrid } from '@web/components/category-grid';
import { AdSlot } from '@web/components/ad-slot';
import { PageHero } from '@web/components/page-hero';
import { SpotlightCarousel } from '@web/components/spotlight-carousel';
import { getAllCategories, getFeaturedArticles, getPublishedArticles } from '@web/lib/content';
import { siteConfig } from '@web/lib/site';
import { getActiveSiteTheme } from '@web/lib/theme';

const HERO_BANNER_FALLBACK: Record<string, string> = {
  bold_magazine: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1800&q=80',
  editorial_luxury: 'https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=1800&q=80',
  warm_wellness: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1800&q=80',
  playful_kids: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1800&q=80',
  technical_minimal: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=80',
  noir_luxury_dark: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1800&q=80',
  midnight_wellness_dark: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1800&q=80',
  arcade_play_dark: 'https://images.unsplash.com/photo-1486572788966-cfd3df1f5b42?auto=format&fit=crop&w=1800&q=80'
};

export default async function HomePage() {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isDark = theme.isDark;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const [featured, articles, categories] = await Promise.all([
    getFeaturedArticles(),
    getPublishedArticles(),
    getAllCategories()
  ]);

  const latest = articles.slice(0, 6);
  const latestGrid = articles.slice(2, 8);
  const laneCarouselItems = (articles.length ? articles : featured).slice(0, 12);
  const carouselItems = (articles.length ? articles : featured).slice(0, 8);
  const wellnessFlow = [
    { label: '01', title: 'Consult & Diagnose', description: 'Understand routines, triggers, and realistic goals before starting.' },
    { label: '02', title: 'Design Your Ritual', description: 'Build a repeatable rhythm with practical weekly actions and checkpoints.' },
    { label: '03', title: 'Track & Refine', description: 'Measure consistency, adjust intensity, and keep only what works.' }
  ];
  const wellnessIndicators = [
    { label: 'Routine consistency', value: 78 },
    { label: 'Sleep quality', value: 64 },
    { label: 'Skin comfort', value: 72 }
  ];
  const heroBackgroundImage =
    siteConfig.brandAssets.heroImageUrl || featured[0]?.coverImage || HERO_BANNER_FALLBACK[recipe] || HERO_BANNER_FALLBACK.bold_magazine;

  const pageClass =
    isDark
      ? 'space-y-12 pb-6'
      : recipe === 'editorial_luxury'
      ? 'space-y-14 pb-8'
      : recipe === 'technical_minimal'
        ? 'space-y-8 pb-4'
        : recipe === 'playful_kids'
          ? 'space-y-12 pb-6'
          : recipe === 'warm_wellness'
            ? 'space-y-11 pb-6'
            : 'space-y-10 pb-6';
  const notePanelClass =
    isDark
      ? isNoirSharp
        ? 'border border-white/15 bg-coal/80 p-6 shadow-[0_22px_64px_-34px_rgba(0,0,0,0.75)] sm:p-8'
        : isArcadeSoft
          ? 'rounded-xl border border-white/15 bg-coal/80 p-6 shadow-[0_22px_64px_-34px_rgba(0,0,0,0.75)] sm:p-8'
          : 'rounded-3xl border border-white/15 bg-coal/80 p-6 shadow-[0_22px_64px_-34px_rgba(0,0,0,0.75)] sm:p-8'
      : recipe === 'technical_minimal'
      ? 'rounded-xl border border-black/20 bg-white p-6'
      : recipe === 'warm_wellness'
        ? 'rounded-xl border border-rose-200 bg-white p-6 shadow-card sm:p-8'
      : recipe === 'editorial_luxury'
        ? 'border border-black/15 bg-white/95 p-8 shadow-[0_24px_60px_-36px_rgba(10,10,10,0.45)]'
        : recipe === 'playful_kids'
          ? 'rounded-[2rem] border-2 border-rust/25 bg-white p-7 shadow-card'
          : 'rounded-3xl border border-black/5 bg-white p-6 shadow-card sm:p-8';
  const metricTileClass = isDark
    ? isNoirSharp
      ? 'border border-white/10 bg-black/25 px-4 py-3'
      : isArcadeSoft
        ? 'rounded-lg border border-white/10 bg-black/25 px-4 py-3'
        : 'rounded-2xl border border-white/10 bg-black/25 px-4 py-3'
    : recipe === 'warm_wellness'
      ? 'rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3'
    : recipe === 'editorial_luxury'
      ? 'border border-black/10 bg-paper/70 px-4 py-3'
      : 'rounded-2xl bg-paper px-4 py-3';
  const metricLabelClass = isDark ? 'text-paper/65' : 'text-ink/60';
  const heroPrimaryButtonClass =
    recipe === 'editorial_luxury'
      ? 'inline-flex rounded-none border border-white/35 bg-white/14 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-white/24'
      : recipe === 'noir_luxury_dark'
        ? 'inline-flex rounded-none border border-white/35 bg-white/14 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-white/24'
      : recipe === 'arcade_play_dark'
        ? 'inline-flex rounded-lg border border-white/35 bg-white/14 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-white/24'
      : recipe === 'warm_wellness'
        ? 'inline-flex rounded-lg border border-white/35 bg-white/14 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-white/24'
      : 'inline-flex rounded-full border border-white/35 bg-white/14 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-white/24';
  const heroSecondaryButtonClass =
    recipe === 'editorial_luxury'
      ? 'inline-flex rounded-none border border-white/30 bg-black/24 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-black/34'
      : recipe === 'noir_luxury_dark'
        ? 'inline-flex rounded-none border border-white/30 bg-black/24 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-black/34'
      : recipe === 'arcade_play_dark'
        ? 'inline-flex rounded-lg border border-white/30 bg-black/24 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-black/34'
      : recipe === 'warm_wellness'
        ? 'inline-flex rounded-lg border border-white/30 bg-black/24 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-black/34'
      : 'inline-flex rounded-full border border-white/30 bg-black/24 px-5 py-3 text-sm font-semibold text-paper backdrop-blur hover:bg-black/34';
  const accentLabelClass = recipe === 'warm_wellness' ? 'text-rose-500' : 'text-rust';

  return (
    <div className={pageClass}>
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-6 w-screen">
        <PageHero
          fullBleed
          eyebrow={siteConfig.niche}
          title={siteConfig.name}
          description={siteConfig.description}
          backgroundImageUrl={heroBackgroundImage}
          actions={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/categories" className={heroPrimaryButtonClass}>
                Explore categories
              </Link>
              <Link href="/about" className={heroSecondaryButtonClass}>
                How the site works
              </Link>
            </div>
          }
        />
      </div>

      <MagazineHero articles={featured} />

      {recipe === 'warm_wellness' ? (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-white via-rose-50/55 to-pink-100/30 p-6 shadow-card sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">Beauty Process</p>
            <h2 className="mt-3 font-display text-3xl leading-[1.08] text-ink sm:text-4xl">Health & beauty, simplified into 3 steps</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {wellnessFlow.map((item) => (
                <div key={item.label} className="rounded-lg border border-rose-200 bg-white/85 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500">{item.label}</p>
                  <h3 className="mt-2 font-display text-lg leading-[1.2] text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/75">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="rounded-xl border border-rose-200 bg-white p-6 shadow-card sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">Progress Snapshot</p>
            <h3 className="mt-3 font-display text-2xl leading-[1.15] text-ink">Wellness indicators</h3>
            <div className="mt-5 space-y-4">
              {wellnessIndicators.map((indicator) => (
                <div key={indicator.label}>
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-rose-900/65">
                    <span>{indicator.label}</span>
                    <span>{indicator.value}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-rose-100">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${indicator.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <Link href="/contact" className="mt-7 inline-flex rounded-lg border border-rose-300 bg-rose-500 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-600">
              Make an appointment
            </Link>
          </aside>
        </section>
      ) : null}

      {recipe === 'technical_minimal' ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-black/15 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/55">Published</p>
            <p className="mt-1 font-display text-2xl text-ink">{articles.length}</p>
          </div>
          <div className="rounded-lg border border-black/15 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/55">Categories</p>
            <p className="mt-1 font-display text-2xl text-ink">{categories.length}</p>
          </div>
          <div className="rounded-lg border border-black/15 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/55">Locale</p>
            <p className="mt-1 font-display text-2xl text-ink">{siteConfig.locale}</p>
          </div>
        </section>
      ) : null}

      <AdSlot name="Home Hero In-feed" minHeight={180} />

      <ArticleCarouselColumns articles={laneCarouselItems} isDark={isDark} recipe={recipe} />

      <section className="space-y-5">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentLabelClass}`}>Topical Clusters</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{`Built for scalable ${siteConfig.niche} publishing`}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/75">
            Categories are structured for evergreen coverage, internal linking, and automated article routing via CMS and n8n workflows.
          </p>
        </div>
        <CategoryGrid categories={categories} />
      </section>

      <LatestDuoSection articles={latest} />

      <AdSlot name="Home Mid In-feed" minHeight={220} />

      <section className="space-y-5">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentLabelClass}`}>More Stories</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">Editorial picks in grid</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {latestGrid.map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </div>
      </section>

      <section className={notePanelClass}>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentLabelClass}`}>Operational Note</p>
            <h2 className="mt-2 font-display text-2xl text-ink">Budget-aware automation mode</h2>
            <p className="mt-3 text-sm leading-6 text-ink/75">
              The publishing engine is designed for 20+ topic candidates/day, but the initial publish quota is throttled to preserve sub-$100 monthly operating cost.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className={metricTileClass}>
              <p className={metricLabelClass}>Target quota</p>
              <p className="font-display text-xl text-ink">4-8/day</p>
            </div>
            <div className={metricTileClass}>
              <p className={metricLabelClass}>Locale</p>
              <p className="font-display text-xl text-ink">{siteConfig.locale}</p>
            </div>
          </div>
        </div>
      </section>

      <SpotlightCarousel articles={carouselItems} subtle />
    </div>
  );
}
