import Link from 'next/link';
import type { Article } from '@web/lib/types';
import { getActiveSiteTheme } from '@web/lib/theme';

export function SpotlightCarousel({ articles, subtle = false }: { articles: Article[]; subtle?: boolean }) {
  const theme = getActiveSiteTheme();
  const isDark = theme.isDark;
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const source = articles.slice(0, 8);

  if (source.length < 2) return null;

  const loopItems = [...source, ...source];
  const frameClass = isDark
    ? `border border-white/15 bg-coal/80 shadow-[0_20px_60px_-34px_rgba(0,0,0,0.78)] ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-2xl'} ${subtle ? 'opacity-80' : ''}`
    : recipe === 'editorial_luxury'
      ? `border border-black/10 bg-white/95 shadow-card ${subtle ? 'opacity-85' : ''}`
      : `rounded-2xl border border-black/10 bg-white/95 shadow-card ${subtle ? 'opacity-85' : ''}`;
  const cardClass = isDark
    ? `min-w-[280px] border border-white/12 bg-black/25 px-4 py-3 text-paper transition hover:border-rust/45 hover:bg-black/35 ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-lg' : 'rounded-xl'}`
    : recipe === 'editorial_luxury'
      ? 'min-w-[280px] border border-black/10 bg-paper/60 px-4 py-3 text-ink transition hover:border-rust/35 hover:bg-paper'
      : recipe === 'warm_wellness'
        ? 'min-w-[280px] rounded-lg border border-rose-200 bg-rose-50/55 px-4 py-3 text-ink transition hover:border-rose-300 hover:bg-rose-50'
      : 'min-w-[280px] rounded-xl border border-black/10 bg-paper/60 px-4 py-3 text-ink transition hover:border-rust/35 hover:bg-paper';
  const accentClass = recipe === 'warm_wellness' ? 'text-rose-500' : 'text-rust';
  const metaClass = isDark ? 'text-paper/60' : 'text-ink/55';
  const titleClass = isDark ? 'text-paper hover:text-rust' : 'text-ink hover:text-rust';

  return (
    <section className={frameClass}>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClass}`}>More to Explore</p>
          <p className={`text-xs ${metaClass}`}>{subtle ? 'Quick picks near the footer to keep browsing' : 'A rotating rail of useful reads to discover next'}</p>
        </div>
      </div>
      <div className="overflow-hidden pb-4">
        <div className="autoblog-carousel-track">
          {loopItems.map((article, index) => (
            <Link key={`${article._id}-${index}`} href={`/articles/${article.slug}`} className={cardClass}>
              <p className={`text-[10px] uppercase tracking-[0.14em] ${metaClass}`}>{article.category.title}</p>
              <p className={`mt-1 line-clamp-2 font-display text-lg leading-[1.2] ${titleClass}`}>{article.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
