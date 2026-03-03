import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';
import { getActiveSiteTheme } from '@web/lib/theme';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn how this AI-assisted Home & DIY editorial site is structured for low-touch publishing and future monetization.'
};

export default function AboutPage() {
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

  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="About"
        title="A modern editorial shell for automated Home & DIY publishing"
        description="This site is designed as a scalable content asset: AI-assisted article generation, automated QA and publishing workflows, and a premium UX that can support ad monetization."
      />

      <section className="grid gap-6 lg:grid-cols-3">
        {[
          {
            title: 'Automation-first',
            text: 'Topics, briefs, drafts, images, QA scoring, and publication can be orchestrated through n8n with budget-aware throttling and minimal manual intervention.'
          },
          {
            title: 'SEO-ready',
            text: 'Structured categories, clean slugs, schema metadata, internal link hooks, and ISR-compatible revalidation are included from the start.'
          },
          {
            title: 'Transferable asset',
            text: 'The project includes docs, infra templates, and operational runbooks so a buyer can maintain or scale the system after acquisition.'
          }
        ].map((card) => (
          <div key={card.title} className={cardClass}>
            <h2 className={titleClass}>{card.title}</h2>
            <p className={textClass}>{card.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
