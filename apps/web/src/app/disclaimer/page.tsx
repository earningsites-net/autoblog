import type { Metadata } from 'next';
import { LegalPage } from '@web/components/legal-page';
import { getLegalPageContent, getLegalPageMetadata } from '@web/lib/legal-pages';

export function generateMetadata(): Metadata {
  return getLegalPageMetadata('disclaimer');
}

export default async function DisclaimerPage() {
  const content = await getLegalPageContent('disclaimer');
  return <LegalPage content={content} />;
}
