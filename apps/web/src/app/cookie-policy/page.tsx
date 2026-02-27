import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Cookie policy template for analytics and advertising integrations.'
};

export default function CookiePolicyPage() {
  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="Legal"
        title="Cookie Policy"
        description="Template cookie policy for MVP launch. Update with your consent manager and ad stack details before production."
      />
      <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-card text-sm leading-7 text-ink/80 sm:p-8">
        <p>
          This site may use essential cookies for site function and optional analytics or advertising cookies when enabled. You should disclose categories, durations,
          and providers (for example analytics and ad partners) in the final live policy.
        </p>
        <p className="mt-4">
          Add a consent banner or CMP before enabling ads or non-essential tracking in jurisdictions that require prior consent.
        </p>
      </section>
    </div>
  );
}
