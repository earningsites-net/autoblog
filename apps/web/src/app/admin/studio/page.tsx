import { redirect } from 'next/navigation';
import { siteConfig } from '@web/lib/site';
import { getPublicSiteSettings, resolvePortalBaseUrl } from '@web/lib/site-settings';

export default async function StudioRedirectPage() {
  const settings = await getPublicSiteSettings();
  const studioUrl = String(settings.studioUrl || '').trim();

  if (studioUrl) {
    redirect(studioUrl);
  }

  const portalBaseUrl = resolvePortalBaseUrl();
  if (portalBaseUrl) {
    redirect(`${portalBaseUrl}/portal?siteSlug=${encodeURIComponent(siteConfig.slug)}`);
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold text-ink">Studio URL not configured</h1>
      <p className="mt-3 text-sm text-ink/70">Configure <code>studioUrl</code> in site settings from the portal.</p>
    </section>
  );
}
