import Link from 'next/link';
import { PageHero } from '@web/components/page-hero';
import type { LegalPageContent } from '@web/lib/legal-pages';
import { getActiveSiteTheme } from '@web/lib/theme';

type LegalPageProps = {
  content: LegalPageContent;
};

export function LegalPage({ content }: LegalPageProps) {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isDark = theme.isDark;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const cardRadius = isNoirSharp ? '' : isArcadeSoft || recipe === 'warm_wellness' || recipe === 'technical_minimal' ? 'rounded-xl' : 'rounded-3xl';
  const cardClass = isDark
    ? `border border-white/15 bg-coal/78 p-6 shadow-[0_22px_56px_-34px_rgba(0,0,0,0.74)] ${cardRadius}`
    : recipe === 'warm_wellness'
      ? 'rounded-xl border border-rose-200 bg-white p-6 shadow-card'
      : recipe === 'editorial_luxury'
        ? 'border border-black/10 bg-white p-6 shadow-card'
        : recipe === 'technical_minimal'
          ? 'rounded-xl border border-black/10 bg-white p-6 shadow-card'
          : 'rounded-3xl border border-black/5 bg-white p-6 shadow-card';
  const accentClass = isDark ? 'text-paper/65' : recipe === 'warm_wellness' ? 'text-rose-500' : 'text-ink/55';
  const titleClass = isDark ? 'mt-3 font-display text-2xl text-paper' : 'mt-3 font-display text-2xl text-ink';
  const bodyClass = isDark ? 'mt-3 text-sm leading-7 text-paper/78' : 'mt-3 text-sm leading-7 text-ink/75';
  const listClass = isDark ? 'mt-4 space-y-2 text-sm leading-6 text-paper/78' : 'mt-4 space-y-2 text-sm leading-6 text-ink/75';
  const summaryClass = isDark
    ? `border border-white/15 bg-coal/82 p-6 shadow-[0_24px_60px_-34px_rgba(0,0,0,0.76)] ${cardRadius}`
    : recipe === 'warm_wellness'
      ? 'rounded-xl border border-rose-200 bg-gradient-to-br from-white via-rose-50/55 to-pink-100/35 p-6 shadow-card'
      : recipe === 'editorial_luxury'
        ? 'border border-black/10 bg-paper/70 p-6 shadow-card'
        : recipe === 'technical_minimal'
          ? 'rounded-xl border border-black/10 bg-paper/70 p-6 shadow-card'
          : 'rounded-3xl border border-black/5 bg-paper/70 p-6 shadow-card';

  return (
    <div className="space-y-8 py-6">
      <PageHero eyebrow={content.eyebrow} title={content.title} description={content.description} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.95fr)]">
        <div className="space-y-5">
          {content.sections.map((section, index) => (
            <section key={section.title} className={cardClass}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClass}`}>Section {String(index + 1).padStart(2, '0')}</p>
              <h2 className={titleClass}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className={bodyClass}>
                  {paragraph}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className={listClass}>
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-[0.45rem] h-1.5 w-1.5 flex-none rounded-full bg-current opacity-70" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
          <section className={summaryClass}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClass}`}>Policy summary</p>
            <h2 className={titleClass}>{content.summaryTitle}</h2>
            <p className={bodyClass}>{content.summaryDescription}</p>
            <ul className={listClass}>
              {content.summaryItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[0.45rem] h-1.5 w-1.5 flex-none rounded-full bg-current opacity-70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={cardClass}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClass}`}>Contact</p>
            <h2 className={titleClass}>{content.contactTitle}</h2>
            <p className={bodyClass}>{content.contactDescription}</p>
            <Link href="/contact" className={`${theme.classes.secondaryButton} mt-5`}>
              {content.contactCtaLabel}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
