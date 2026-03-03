import Image from 'next/image';
import Link from 'next/link';
import type { Article } from '@web/lib/types';
import { formatDate } from '@web/lib/site';
import { getSiteCopy } from '@web/lib/site-copy';
import { getActiveSiteTheme } from '@web/lib/theme';

export function LatestDuoSection({ articles }: { articles: Article[] }) {
  const theme = getActiveSiteTheme();
  const isDark = theme.isDark;
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const copy = getSiteCopy();
  const picks = articles.slice(0, 2);
  if (!picks.length) return null;

  const cardClass = isDark
    ? `overflow-hidden border border-white/15 bg-coal/78 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.78)] ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-[1.4rem]'}`
    : recipe === 'editorial_luxury'
      ? 'overflow-hidden border border-black/10 bg-white shadow-card'
      : recipe === 'warm_wellness'
        ? 'overflow-hidden rounded-xl border border-rose-200 bg-white shadow-card'
      : 'overflow-hidden rounded-[1.4rem] border border-black/10 bg-white shadow-card';
  const metaClass = isDark
    ? 'flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-paper/62'
    : 'flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-ink/55';
  const titleClass = isDark ? 'mt-3 font-display text-2xl leading-[1.15] text-paper' : 'mt-3 font-display text-2xl leading-[1.15] text-ink';
  const excerptClass = isDark ? 'mt-3 text-sm leading-7 text-paper/78' : 'mt-3 text-sm leading-7 text-ink/75';
  const accentClass = recipe === 'warm_wellness' ? 'text-rose-500' : 'text-rust';
  const viewAllClass = recipe === 'warm_wellness' ? 'text-sm font-medium text-ink hover:text-rose-500' : 'text-sm font-medium text-ink hover:text-rust';

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClass}`}>{copy.home.latestEyebrow}</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{copy.home.latestTitle}</h2>
        </div>
        <Link href="/categories" className={viewAllClass}>
          View all categories →
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {picks.map((article) => (
          <Link key={article._id} href={`/articles/${article.slug}`} className={cardClass}>
            <div className="relative aspect-[16/9] overflow-hidden">
              <Image src={article.coverImage} alt={article.coverImageAlt} fill className="object-cover transition duration-500 hover:scale-[1.02]" sizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
            <div className="p-5 sm:p-6">
              <div className={metaClass}>
                <span>{article.category.title}</span>
                <span aria-hidden>•</span>
                <span>{formatDate(article.publishedAt)}</span>
                <span aria-hidden>•</span>
                <span>{article.readTimeMinutes} min read</span>
              </div>
              <h3 className={titleClass}>{article.title}</h3>
              <p className={excerptClass}>{article.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
