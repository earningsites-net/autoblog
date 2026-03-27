import Link from 'next/link';

type SiteOfflineProps = {
  brandName: string;
  portalBaseUrl: string;
};

const portalShellStyle = {
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  background:
    'radial-gradient(980px 620px at 0% -8%, rgba(75, 118, 255, .24) 0%, rgba(75, 118, 255, 0) 62%), radial-gradient(900px 560px at 100% -12%, rgba(255, 111, 184, .22) 0%, rgba(255, 111, 184, 0) 60%), radial-gradient(840px 520px at 50% 118%, rgba(75, 214, 255, .16) 0%, rgba(75, 214, 255, 0) 58%), linear-gradient(135deg, #f9fbff 0%, #f1f6ff 52%, #fff5fa 100%)'
} as const;

const portalCardStyle = {
  background:
    'radial-gradient(420px 240px at -8% -10%, rgba(255,255,255,.24) 0%, rgba(255,255,255,0) 65%), radial-gradient(340px 200px at 120% 110%, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 62%), linear-gradient(140deg, #2b66ff 0%, #3551dc 48%, #8b3cf2 100%)'
} as const;

export function SiteOffline({ brandName, portalBaseUrl }: SiteOfflineProps) {
  const ownerPortalHref = portalBaseUrl ? `${portalBaseUrl}/portal` : '/portal';

  return (
    <div style={portalShellStyle} className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section
          style={portalCardStyle}
          className="w-full max-w-3xl rounded-[1.75rem] border border-[#dfe6f5] px-8 py-10 text-center text-white shadow-[0_30px_84px_-44px_rgba(18,48,115,.46)] sm:px-12 sm:py-14"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/80">Site Offline</p>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-4xl">
            {brandName} is temporarily unavailable.
          </h1>
          <div className="mt-8 border-t border-white/20 pt-5 text-sm text-white/90">
            <Link href={ownerPortalHref} className="font-semibold text-white underline underline-offset-2 hover:text-white/85">
              Site owner? Access the portal
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
