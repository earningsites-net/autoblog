import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@web/components/page-hero';
import { getFeaturedArticles } from '@web/lib/content';
import { getSiteCopy } from '@web/lib/site-copy';
import { getActiveSiteTheme } from '@web/lib/theme';

const copy = getSiteCopy();

export const metadata: Metadata = {
  title: 'About',
  description: copy.about.metadataDescription
};

export default async function AboutPage() {
  const featured = await getFeaturedArticles();
  const heroStory = featured[0];
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isDark = theme.isDark;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const cardClass = isDark
    ? `border border-white/15 bg-coal/78 p-6 shadow-[0_22px_56px_-34px_rgba(0,0,0,0.74)] ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-3xl'}`
    : 'rounded-3xl border border-black/5 bg-white p-6 shadow-card';
  const titleClass = isDark ? 'font-display text-2xl text-paper' : 'font-display text-2xl text-ink';
  const textClass = isDark ? 'mt-3 text-sm leading-6 text-paper/78' : 'mt-3 text-sm leading-6 text-ink/75';
  const spotlightPanelClass = isDark
    ? `border border-white/15 bg-coal/80 p-6 shadow-[0_24px_60px_-34px_rgba(0,0,0,0.76)] ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-3xl'}`
    : recipe === 'editorial_luxury'
      ? 'border border-black/10 bg-white p-6 shadow-card'
      : 'rounded-3xl border border-black/5 bg-white p-6 shadow-card';
  const spotlightImageClass = isDark
    ? isNoirSharp
      ? 'relative aspect-[16/9] overflow-hidden border border-white/15'
      : 'relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/15'
    : recipe === 'editorial_luxury'
      ? 'relative aspect-[16/9] overflow-hidden border border-black/10'
      : 'relative aspect-[16/9] overflow-hidden rounded-2xl border border-black/10';
  const spotlightMetaClass = isDark ? 'text-paper/65' : 'text-ink/55';
  const spotlightTitleClass = isDark ? 'mt-3 font-display text-2xl text-paper' : 'mt-3 font-display text-2xl text-ink';
  const spotlightBodyClass = isDark ? 'mt-3 text-sm leading-7 text-paper/78' : 'mt-3 text-sm leading-7 text-ink/75';
  const spotlightButtonClass = isDark
    ? recipe === 'noir_luxury_dark'
      ? 'mt-5 inline-flex border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-paper hover:bg-white/18'
      : recipe === 'arcade_play_dark'
        ? 'mt-5 inline-flex rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-paper hover:bg-white/18'
        : 'mt-5 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-paper hover:bg-white/18'
    : recipe === 'editorial_luxury'
      ? 'mt-5 inline-flex border border-black/20 bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-black/35'
      : 'mt-5 inline-flex rounded-full border border-black/15 bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-black/30';

  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow={copy.about.heroEyebrow}
        title={copy.about.heroTitle}
        description={copy.about.heroDescription}
      />

      {heroStory ? (
        <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <Link href={`/articles/${heroStory.slug}`} className={spotlightImageClass}>
            <Image
              src={heroStory.coverImage}
              alt={heroStory.coverImageAlt}
              fill
              className="object-cover transition duration-500 hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </Link>
          <div className={spotlightPanelClass}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${spotlightMetaClass}`}>Featured Read</p>
            <h2 className={spotlightTitleClass}>{heroStory.title}</h2>
            <p className={spotlightBodyClass}>
              Start here if you want a clear, practical entry point before exploring the rest of the site.
            </p>
            <Link href={`/articles/${heroStory.slug}`} className={spotlightButtonClass}>
              Read featured guide
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-3">
        {copy.about.cards.map((card) => (
          <div key={card.title} className={cardClass}>
            <h2 className={titleClass}>{card.title}</h2>
            <p className={textClass}>{card.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
