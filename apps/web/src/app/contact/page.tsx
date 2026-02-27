import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact page for editorial and business inquiries related to the site.'
};

export default function ContactPage() {
  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="Contact"
        title="Editorial and business inquiries"
        description="Use the channels below for partnerships, business inquiries, or operational questions about this content property."
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl text-ink">Business Contact</h2>
          <p className="mt-3 text-sm leading-6 text-ink/75">Replace this placeholder with your preferred email address before launch or handoff.</p>
          <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-sm text-ink/80">hello@example.com</p>
        </div>
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl text-ink">Important Note</h2>
          <p className="mt-3 text-sm leading-6 text-ink/75">
            This site publishes informational content and does not provide licensed professional, legal, financial, or medical advice.
          </p>
        </div>
      </section>
    </div>
  );
}
