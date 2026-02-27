import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn how this AI-assisted Home & DIY editorial site is structured for low-touch publishing and future monetization.'
};

export default function AboutPage() {
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
          <div key={card.title} className="rounded-3xl border border-black/5 bg-white p-6 shadow-card">
            <h2 className="font-display text-2xl text-ink">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/75">{card.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
