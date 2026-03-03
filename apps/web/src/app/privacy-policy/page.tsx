import type { Metadata } from 'next';
import { PageHero } from '@web/components/page-hero';
import { getSiteCopy } from '@web/lib/site-copy';

const copy = getSiteCopy();

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: copy.privacy.metadataDescription
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="Template privacy policy for MVP launch. Replace placeholders with your legal/business details before going live."
      />
      <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-card text-sm leading-7 text-ink/80 sm:p-8">
        <p>
          We may collect standard analytics, device, and usage data to improve the site experience and support advertising and content performance measurement.
          If ad networks or analytics providers are enabled, their tools may use cookies or similar technologies as described in their own policies.
        </p>
        <p className="mt-4">
          Replace this text with a jurisdiction-appropriate policy covering data controller details, lawful basis, retention periods, cookie categories, and contact rights.
        </p>
      </section>
    </div>
  );
}
