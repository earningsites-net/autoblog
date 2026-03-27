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
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
} as const;

export function SiteOffline({ brandName, portalBaseUrl }: SiteOfflineProps) {
  const ownerPortalHref = portalBaseUrl ? `${portalBaseUrl}/portal` : '/portal';

  return (
    <div style={portalShellStyle} className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section
          style={portalCardStyle}
          className="w-full max-w-3xl rounded-[1.75rem] border border-[#dfe6f5] px-8 py-10 text-[#101a34] shadow-[0_30px_84px_-44px_rgba(18,48,115,.46)] sm:px-12 sm:py-14"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#5a6f96]">Site Offline</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-5xl">
            {brandName} is temporarily unavailable.
          </h1>
          <div className="mt-8 border-t border-[#e2e9fb] pt-5 text-sm text-[#5a6f96]">
            <Link href={ownerPortalHref} className="font-semibold text-[#2458d1] underline underline-offset-2 hover:text-[#193f9b]">
              Site owner? Access the portal
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
