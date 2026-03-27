import { redirect } from 'next/navigation';
import { siteConfig } from '@web/lib/site';
import { resolvePortalBaseUrl } from '@web/lib/site-settings';

export default function PortalRedirectPage() {
  const baseUrl = resolvePortalBaseUrl();
  if (!baseUrl) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-ink">Portal not configured</h1>
        <p className="mt-3 text-sm text-ink/70">
          Set <code>NEXT_PUBLIC_PORTAL_BASE_URL</code> to enable portal redirect.
        </p>
      </section>
    );
  }

  redirect(`${baseUrl}/portal?siteSlug=${encodeURIComponent(siteConfig.slug)}`);
}
