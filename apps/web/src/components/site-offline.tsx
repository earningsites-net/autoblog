import Link from 'next/link';

type SiteOfflineProps = {
  brandName: string;
  siteSlug: string;
  portalBaseUrl: string;
};

export function SiteOffline({ brandName, siteSlug, portalBaseUrl }: SiteOfflineProps) {
  const ownerPortalHref = portalBaseUrl ? `${portalBaseUrl}/portal` : '';

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <section className="grid w-full gap-8 overflow-hidden rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.45)] backdrop-blur sm:p-10 lg:grid-cols-[1.3fr_0.7fr] lg:p-14 dark:border-white/10 dark:bg-coal/75">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-rust/30 bg-rust/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rust">
              Site Offline
            </p>
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.22em] text-ink/55 dark:text-paper/55">{siteSlug}</p>
              <h1 className="font-display text-4xl leading-[0.96] text-ink sm:text-5xl lg:text-6xl dark:text-paper">
                {brandName} is temporarily unavailable.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-ink/72 dark:text-paper/72">
                This publication is currently offline while access is being reactivated. Content and archives remain managed
                behind the scenes, but the public storefront is paused until the subscription status is restored.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {ownerPortalHref ? (
                <Link
                  href={ownerPortalHref}
                  className="inline-flex items-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-coal dark:bg-paper dark:text-coal dark:hover:bg-paper/85"
                >
                  Owner Portal
                </Link>
              ) : null}
              <span className="inline-flex items-center rounded-full border border-black/10 px-5 py-3 text-sm text-ink/68 dark:border-white/15 dark:text-paper/68">
                Status: unavailable to visitors
              </span>
            </div>
          </div>

          <aside className="grid gap-4 self-stretch">
            <div className="rounded-[1.5rem] border border-black/10 bg-paper/70 p-5 dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/55 dark:text-paper/55">What this means</p>
              <p className="mt-3 text-sm leading-6 text-ink/72 dark:text-paper/72">
                Visitors see this holding page instead of the live magazine until the site returns to an active commercial state.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-black/10 bg-paper/70 p-5 dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/55 dark:text-paper/55">Owner note</p>
              <p className="mt-3 text-sm leading-6 text-ink/72 dark:text-paper/72">
                Use the portal to reactivate billing or restore service access. Editorial content remains managed separately.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
