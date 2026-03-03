import { ArticleCard } from './article-card';
import type { Article } from '@web/lib/types';
import Link from 'next/link';
import { siteConfig } from '@web/lib/site';
import { getSiteCopy } from '@web/lib/site-copy';
import { getActiveSiteTheme } from '@web/lib/theme';

export function MagazineHero({ articles }: { articles: Article[] }) {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const copy = getSiteCopy();
  const [main, ...rest] = articles;

  if (!main) {
    return (
      <section className={theme.classes.pageHero}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rust">{copy.magazineHeroEmpty.eyebrow}</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          {copy.magazineHeroEmpty.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/75">
          {copy.magazineHeroEmpty.description}
        </p>
        <Link href="/categories" className={`mt-8 ${theme.classes.primaryButton}`}>
          {copy.magazineHeroEmpty.ctaLabel}
        </Link>
      </section>
    );
  }

  if (theme.isDark) {
    return (
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ArticleCard article={main} featured />
        <aside className={`border border-white/15 bg-coal/80 p-6 shadow-[0_22px_56px_-32px_rgba(0,0,0,0.74)] ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-[1.6rem]'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/65">Spotlight</p>
          <div className="mt-4 space-y-4">
            {rest.slice(0, 4).map((article) => (
              <Link key={article._id} href={`/articles/${article.slug}`} className="group block border-b border-white/10 pb-4 last:border-0 last:pb-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-paper/55">{article.category.title}</p>
                <p className="mt-2 font-display text-lg leading-[1.2] text-paper group-hover:text-rust">{article.title}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    );
  }

  if (recipe === 'editorial_luxury') {
    return (
      <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <ArticleCard article={main} featured />
        <aside className="border border-black/15 bg-white/95 p-6 shadow-[0_24px_55px_-34px_rgba(10,10,10,0.45)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rust">Editor Picks</p>
          <div className="mt-5 space-y-5">
            {rest.slice(0, 4).map((article) => (
              <Link key={article._id} href={`/articles/${article.slug}`} className="group block border-b border-black/10 pb-4 last:border-0 last:pb-0">
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink/55">{article.category.title}</p>
                <p className="mt-2 font-display text-xl leading-[1.2] text-ink group-hover:text-rust">{article.title}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    );
  }

  if (recipe === 'technical_minimal') {
    return (
      <section className="space-y-5">
        <ArticleCard article={main} featured />
        <div className="overflow-hidden rounded-xl border border-black/15 bg-white">
          <div className="grid grid-cols-[auto_1fr_auto] gap-3 border-b border-black/10 bg-paper/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/60">
            <span>#</span>
            <span>Recent Guides</span>
            <span>Open</span>
          </div>
          {rest.slice(0, 4).map((article, index) => (
            <Link
              key={article._id}
              href={`/articles/${article.slug}`}
              className={`grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-4 transition hover:bg-paper/60 ${index < 3 ? 'border-b border-black/10' : ''}`}
            >
              <span className="text-sm font-semibold text-rust">{String(index + 1).padStart(2, '0')}</span>
              <span className="text-sm text-ink">{article.title}</span>
              <span className="text-xs uppercase tracking-[0.12em] text-ink/60">→</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (recipe === 'playful_kids') {
    return (
      <section className="space-y-5">
        <ArticleCard article={main} featured />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {rest.slice(0, 4).map((article) => (
            <Link
              key={article._id}
              href={`/articles/${article.slug}`}
              className="group relative overflow-hidden rounded-3xl border-2 border-rust/25 bg-white p-4 shadow-card transition hover:-translate-y-1"
            >
              <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-rust/18" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rust">{article.category.title}</p>
              <p className="mt-2 font-display text-lg leading-[1.2] text-ink group-hover:text-rust">{article.title}</p>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (recipe === 'warm_wellness') {
    return (
      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <ArticleCard article={main} featured />
        <aside className="rounded-xl border border-rose-200 bg-gradient-to-br from-white via-rose-50/40 to-pink-100/25 p-6 shadow-card sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">Beauty Flow</p>
          <h3 className="mt-3 font-display text-3xl leading-[1.08] text-ink">What can we do for you?</h3>
          <p className="mt-3 text-sm leading-7 text-ink/75">
            Inspired by beauty clinic editorials: map concerns, personalize your plan, and maintain a calm routine with visible progress.
          </p>
          <div className="mt-6 space-y-4">
            {rest.slice(0, 3).map((article, index) => (
              <Link key={article._id} href={`/articles/${article.slug}`} className="group flex gap-3 border-b border-rose-200 pb-4 last:border-0 last:pb-0">
                <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-rose-100 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-rose-900/55">{article.category.title}</p>
                  <p className="mt-1 font-display text-lg leading-[1.2] text-ink group-hover:text-rose-500">{article.title}</p>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/contact" className="mt-6 inline-flex rounded-lg border border-rose-300 bg-rose-500 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-600">
            Book a visit now
          </Link>
        </aside>
      </section>
    );
  }

  if (recipe === 'bold_magazine') {
    return (
      <section className={theme.classes.heroGrid}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <ArticleCard article={main} featured fillHeight preferBodyPreview />
          </div>
          <div className="mt-6">
            <Link href="/categories" className={`w-full justify-center ${theme.classes.primaryButton}`}>
              Read all stories
            </Link>
          </div>
        </div>
        <aside className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {rest.slice(0, 3).map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </aside>
      </section>
    );
  }

  return (
    <section className={`${theme.classes.heroGrid} items-start`}>
      <ArticleCard article={main} featured />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
        {rest.slice(0, 4).map((article) => (
          <ArticleCard key={article._id} article={article} />
        ))}
      </div>
    </section>
  );
}
