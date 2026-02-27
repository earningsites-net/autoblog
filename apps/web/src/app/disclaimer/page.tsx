import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'Informational content disclaimer for Home & DIY articles.'
};

export default function DisclaimerPage() {
  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="Legal"
        title="Disclaimer"
        description="The content published on this site is informational and general in nature. It is not a substitute for professional advice or licensed trade services."
      />
      <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-card text-sm leading-7 text-ink/80 sm:p-8">
        <p>
          Home improvement and maintenance tasks can involve safety risks. Always assess your situation, use appropriate protective equipment, and consult a qualified professional for work beyond your skill level.
        </p>
        <p className="mt-4">
          This site excludes advanced electrical, structural, legal, financial, and medical guidance from its editorial scope. If such content is introduced later, add topic-specific disclaimers and review procedures.
        </p>
      </section>
    </div>
  );
}
