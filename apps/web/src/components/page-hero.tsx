import type { ReactNode } from 'react';
import { getActiveSiteTheme } from '@web/lib/theme';

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  subtitle?: string;
  actions?: ReactNode;
  backgroundImageUrl?: string;
  fullBleed?: boolean;
};

export function PageHero({ eyebrow, title, description, subtitle, actions, backgroundImageUrl, fullBleed = false }: PageHeroProps) {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const isDark = theme.isDark;
  const copy = subtitle || description || '';

  if (backgroundImageUrl) {
    const overlayGradientClass = theme.isDark
      ? 'absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/40'
      : 'absolute inset-0 bg-gradient-to-b from-black/5 via-black/15 to-black/30';
    const frameClass = theme.isDark
      ? 'border border-white/15 shadow-[0_32px_84px_-40px_rgba(0,0,0,0.8)]'
      : 'border border-black/10 shadow-[0_30px_80px_-42px_rgba(0,0,0,0.58)]';
    const bleedClass = fullBleed
      ? 'rounded-none border-0 shadow-none'
      : recipe === 'editorial_luxury' || isNoirSharp
        ? 'rounded-none'
        : isArcadeSoft
          ? 'rounded-xl'
          : 'rounded-[2rem]';
    const containerClass = fullBleed
      ? 'relative z-10 flex min-h-[650px] items-center justify-center px-4 text-center'
      : 'relative z-10 flex min-h-[650px] items-end';
    const textPanelClass = theme.isDark
      ? fullBleed
        ? isNoirSharp
          ? 'mx-auto max-w-3xl bg-black/54 px-7 py-9 backdrop-blur-[2px] sm:px-10'
          : isArcadeSoft
            ? 'mx-auto max-w-3xl rounded-xl bg-black/54 px-7 py-9 backdrop-blur-[2px] sm:px-10'
            : 'mx-auto max-w-3xl rounded-2xl bg-black/54 px-7 py-9 backdrop-blur-[2px] sm:px-10'
        : recipe === 'editorial_luxury' || isNoirSharp
          ? 'max-w-3xl bg-black/40 px-7 pb-8 pt-10 backdrop-blur-[2px] sm:px-10 sm:pb-10 sm:pt-14'
          : isArcadeSoft
            ? 'max-w-3xl rounded-xl bg-black/40 px-7 pb-8 pt-10 backdrop-blur-[2px] sm:px-10 sm:pb-10 sm:pt-14'
            : 'max-w-3xl rounded-2xl bg-black/40 px-7 pb-8 pt-10 backdrop-blur-[2px] sm:px-10 sm:pb-10 sm:pt-14'
      : fullBleed
        ? recipe === 'editorial_luxury'
          ? 'mx-auto max-w-3xl bg-black/44 px-7 py-9 backdrop-blur-[2px] sm:px-10'
          : 'mx-auto max-w-3xl rounded-2xl bg-black/44 px-7 py-9 backdrop-blur-[2px] sm:px-10'
        : recipe === 'editorial_luxury'
          ? 'max-w-3xl bg-black/30 px-7 pb-8 pt-10 backdrop-blur-[2px] sm:px-10 sm:pb-10 sm:pt-14'
          : 'max-w-3xl rounded-2xl bg-black/30 px-7 pb-8 pt-10 backdrop-blur-[2px] sm:px-10 sm:pb-10 sm:pt-14';

    return (
      <section className={`relative min-h-[650px] overflow-hidden ${frameClass} ${bleedClass}`}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImageUrl})`, filter: 'brightness(0.88) saturate(1.04)' }} />
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} />
        <div className={overlayGradientClass} />
        <div className={containerClass}>
          <div className={textPanelClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-paper/85">{eyebrow}</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.06] text-paper [text-shadow:0_4px_22px_rgba(0,0,0,0.62)] sm:text-6xl">{title}</h1>
            {copy ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-paper [text-shadow:0_3px_16px_rgba(0,0,0,0.74)] sm:text-base">
                {copy}
              </p>
            ) : null}
            {actions ? <div className="mt-7 flex justify-center">{actions}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  if (recipe === 'editorial_luxury') {
    return (
      <section className="relative overflow-hidden border border-black/15 bg-white/95 px-8 py-10 shadow-[0_34px_80px_-45px_rgba(10,10,10,0.5)] sm:px-12 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.65fr_1fr] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-rust">{eyebrow}</p>
            <h1 className="mt-5 max-w-3xl font-display text-[2.8rem] leading-[1.04] text-ink sm:text-[3.35rem]">{title}</h1>
            {copy ? <p className="mt-5 max-w-2xl text-base leading-8 text-ink/75">{copy}</p> : null}
            {actions ? <div className="mt-8">{actions}</div> : null}
          </div>
          <aside className="border border-black/10 bg-paper/70 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/55">Editorial Note</p>
            <p className="mt-3 text-sm leading-7 text-ink/75">
              Structured for premium long-form clusters, polished internal linking, and distinct visual identity per niche.
            </p>
          </aside>
        </div>
      </section>
    );
  }

  if (recipe === 'playful_kids') {
    return (
      <section className="relative overflow-hidden rounded-[2.25rem] border-2 border-rust/25 bg-white px-7 py-8 shadow-card sm:px-9 sm:py-10">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-rust/18" />
        <div className="absolute -left-14 bottom-0 h-40 w-40 rounded-full bg-sage/20" />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">{eyebrow}</p>
        <h1 className="relative mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
        {copy ? <p className="relative mt-4 max-w-2xl text-base leading-7 text-ink/80">{copy}</p> : null}
        {actions ? <div className="relative mt-6">{actions}</div> : null}
      </section>
    );
  }

  if (recipe === 'technical_minimal') {
    return (
      <section className="overflow-hidden rounded-xl border border-black/20 bg-white">
        <div className="border-b border-black/10 bg-coal px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-paper/75">{eyebrow}</div>
        <div className="grid gap-6 px-5 py-7 lg:grid-cols-[1.8fr_1fr] lg:items-start">
          <div>
            <h1 className="max-w-3xl font-display text-[2.1rem] leading-[1.08] text-ink sm:text-[2.6rem]">{title}</h1>
            {copy ? <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/80">{copy}</p> : null}
            {actions ? <div className="mt-6">{actions}</div> : null}
          </div>
          <div className="space-y-2 rounded-lg border border-black/10 bg-paper/60 p-4 text-xs text-ink/70">
            <p className="font-semibold uppercase tracking-[0.12em] text-ink/60">Pipeline</p>
            <p>Discover → Learn → Apply</p>
            <p className="font-semibold uppercase tracking-[0.12em] text-ink/60">Focus</p>
            <p>Practical guides and clear next steps</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={theme.classes.pageHero}>
      <div
        className={`absolute inset-x-0 top-0 h-1 ${
          recipe === 'warm_wellness'
            ? 'bg-gradient-to-r from-rose-300 via-pink-200 to-rose-300'
            : 'bg-gradient-to-r from-rust via-sage to-rust'
        }`}
      />
      <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${recipe === 'warm_wellness' ? 'text-rose-500' : 'text-rust'}`}>{eyebrow}</p>
      <h1 className={`mt-4 max-w-3xl font-display text-4xl leading-tight sm:text-5xl ${isDark ? 'text-paper' : 'text-ink'}`}>{title}</h1>
      {copy ? <p className={`mt-4 max-w-2xl text-base leading-7 ${isDark ? 'text-paper/78' : 'text-ink/75'}`}>{copy}</p> : null}
      {actions ? <div className="mt-6">{actions}</div> : null}
    </section>
  );
}
