import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';
import { getPublicSiteSettings } from '@web/lib/site-settings';
import { getActiveSiteTheme } from '@web/lib/theme';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact page for editorial and business inquiries related to the site.'
};

export default async function ContactPage() {
  const settings = await getPublicSiteSettings();
  const publicContactEmail = String(settings.publicContactEmail || '').trim();
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isDark = theme.isDark;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const cardClass = isDark
    ? `border border-white/15 bg-coal/78 p-6 shadow-[0_22px_56px_-34px_rgba(0,0,0,0.74)] ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-xl' : 'rounded-3xl'}`
    : recipe === 'warm_wellness'
      ? 'rounded-xl border border-rose-200 bg-white p-6 shadow-card'
      : 'rounded-3xl border border-black/5 bg-white p-6 shadow-card';
  const titleClass = isDark ? 'font-display text-2xl text-paper' : 'font-display text-2xl text-ink';
  const textClass = isDark ? 'mt-3 text-sm leading-6 text-paper/78' : 'mt-3 text-sm leading-6 text-ink/75';
  const emailClass = isDark
    ? `mt-4 border border-white/15 bg-black/25 px-4 py-3 text-sm text-paper/82 ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-lg' : 'rounded-2xl'}`
    : recipe === 'warm_wellness'
      ? 'mt-4 rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-ink/80'
      : 'mt-4 rounded-2xl bg-paper px-4 py-3 text-sm text-ink/80';

  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="Contact"
        title="Editorial and business inquiries"
        description="Use the channels below for partnerships, business inquiries, or operational questions about this content property."
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className={titleClass}>Business Contact</h2>
          <p className={textClass}>Use the public address below for partnerships, business inquiries, privacy requests, or content-related questions.</p>
          {publicContactEmail ? (
            <a href={`mailto:${publicContactEmail}`} className={`${emailClass} block font-medium underline-offset-4 hover:underline`}>
              {publicContactEmail}
            </a>
          ) : (
            <p className={emailClass}>Public contact details will be available soon.</p>
          )}
        </div>
        <div className={cardClass}>
          <h2 className={titleClass}>Important Note</h2>
          <p className={textClass}>
            This site publishes informational content and does not provide licensed professional, legal, financial, or medical advice.
          </p>
        </div>
      </section>
    </div>
  );
}
