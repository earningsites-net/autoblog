import type { Metadata } from 'next';
import { LegalPage } from '@web/components/legal-page';
import { getLegalPageContent, getLegalPageMetadata } from '@web/lib/legal-pages';

export function generateMetadata(): Metadata {
  return getLegalPageMetadata('cookie');
}

export default async function CookiePolicyPage() {
  const content = await getLegalPageContent('cookie');
  return <LegalPage content={content} />;
}
