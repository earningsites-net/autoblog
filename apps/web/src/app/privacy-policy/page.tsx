import type { Metadata } from 'next';
import { LegalPage } from '@web/components/legal-page';
import { getLegalPageContent, getLegalPageMetadata } from '@web/lib/legal-pages';

export function generateMetadata(): Metadata {
  return getLegalPageMetadata('privacy');
}

export default async function PrivacyPolicyPage() {
  const content = await getLegalPageContent('privacy');
  return <LegalPage content={content} />;
}
