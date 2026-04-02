import Link from 'next/link';
import type { Category } from '@web/lib/types';
import { getActiveSiteTheme } from '@web/lib/theme';

export function CategoryGrid({ categories }: { categories: Category[] }) {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';

  if (theme.isDark) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category, index) => (
          <Link
            key={category._id}
            href={`/categories/${category.slug}`}
            className={`group relative overflow-hidden border border-white/15 bg-coal/80 p-6 shadow-[0_20px_52px_-30px_rgba(0,0,0,0.75)] transition hover:-translate-y-0.5 ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-[1.6rem]'}`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rust/20 blur-xl" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper/65">Category</p>
            <h3 className="mt-3 font-display text-2xl text-paper group-hover:text-rust">{category.title}</h3>
            <p className="mt-3 text-sm leading-6 text-paper/78">{category.description}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-paper">
              Browse guides <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>
    );
  }

  if (recipe === 'technical_minimal') {
    return (
      <div className="overflow-hidden rounded-xl border border-black/15 bg-white">
        <div className="grid grid-cols-[1.6fr_2.4fr_auto] gap-3 border-b border-black/10 bg-coal px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper/80">
          <span>Category</span>
          <span>Description</span>
          <span>Open</span>
        </div>
        <div>
          {categories.map((category, index) => (
            <Link
              key={category._id}
              href={`/categories/${category.slug}`}
              className={`grid grid-cols-[1.6fr_2.4fr_auto] gap-3 px-4 py-4 transition hover:bg-paper/70 ${index < categories.length - 1 ? 'border-b border-black/10' : ''}`}
            >
              <p className="font-display text-base text-ink">{category.title}</p>
              <p className="text-sm leading-6 text-ink/75">{category.description}</p>
              <span className="self-center text-xs font-semibold uppercase tracking-[0.12em] text-rust">Open →</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (recipe === 'editorial_luxury') {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        {categories.map((category, index) => (
          <Link
            key={category._id}
            href={`/categories/${category.slug}`}
            className="group relative overflow-hidden border border-black/15 bg-white/95 p-7 shadow-[0_28px_60px_-34px_rgba(10,10,10,0.45)] transition hover:-translate-y-0.5"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/55">Curated</p>
            <h3 className="mt-4 font-display text-[1.75rem] leading-[1.15] text-ink group-hover:text-rust">{category.title}</h3>
            <p className="mt-4 text-sm leading-7 text-ink/75">{category.description}</p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-ink">
              Explore collection <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </span>
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-rust/20" />
          </Link>
        ))}
      </div>
    );
  }

  if (recipe === 'warm_wellness') {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {categories.map((category, index) => (
          <Link
            key={category._id}
            href={`/categories/${category.slug}`}
            className="group relative overflow-hidden rounded-xl border border-rose-200 bg-gradient-to-br from-white via-rose-50/55 to-pink-100/35 p-6 shadow-card transition hover:-translate-y-0.5"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-rose-100 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-4 font-display text-[1.8rem] leading-[1.12] text-ink group-hover:text-rose-500">{category.title}</h3>
            <p className="mt-3 text-sm leading-7 text-ink/75">{category.description}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink">
              Explore this topic <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>
    );
  }

  if (recipe === 'playful_kids') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category, index) => (
          <Link
            key={category._id}
            href={`/categories/${category.slug}`}
            className="group relative overflow-hidden rounded-[2rem] border-2 border-rust/30 bg-white p-6 shadow-card transition hover:-translate-y-1"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-rust/20" />
            <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-sage/20" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Zone</p>
            <h3 className="mt-3 font-display text-2xl leading-[1.1] text-ink group-hover:text-rust">{category.title}</h3>
            <p className="mt-3 text-sm leading-6 text-ink/80">{category.description}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink">
              Jump in <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className={theme.classes.categoryGrid}>
      {categories.map((category, index) => (
        <Link
          key={category._id}
          href={`/categories/${category.slug}`}
          className={theme.classes.categoryCard}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-gradient-to-br from-rust/20 to-sage/20 blur-2xl" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/55">Category</p>
          <h3 className="mt-3 font-display text-2xl text-ink group-hover:text-rust">{category.title}</h3>
          <p className="mt-3 text-sm leading-6 text-ink/75">{category.description}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink">
            Browse guides <span aria-hidden className="transition group-hover:translate-x-1">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
