import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'Informational content disclaimer for editorial articles.'
};

export default function DisclaimerPage() {
  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="Legal"
        title="Disclaimer"
        description="The content published on this site is informational and general in nature. It is not a substitute for professional, legal, medical, financial, or other licensed advice."
      />
      <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-card text-sm leading-7 text-ink/80 sm:p-8">
        <p>
          Always evaluate the context of any article before acting on it. Some topics may require professional judgment, additional verification, or advice from a qualified expert.
        </p>
        <p className="mt-4">
          This site is designed for general informational publishing, not regulated or personalized advice. If higher-risk topics are introduced later, they should include topic-specific disclaimers and stricter editorial review.
        </p>
      </section>
    </div>
  );
}
