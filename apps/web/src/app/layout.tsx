import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Script from 'next/script';
import {
  Baloo_2,
  Cormorant_Garamond,
  IBM_Plex_Sans,
  Manrope,
  Merriweather,
  Nunito,
  Playfair_Display,
  Sora,
  Source_Serif_4,
  Space_Grotesk
} from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@web/components/site-header';
import { SiteFooter } from '@web/components/site-footer';
import { RouteLoadingOverlay } from '@web/components/route-loading-overlay';
import { defaultMetadata } from '@web/lib/seo';
import { getPublicSiteSettings, resolveAdPublisherId } from '@web/lib/site-settings';
import { getActiveSiteTheme } from '@web/lib/theme';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['400', '600', '700']
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif-4',
  weight: ['400', '500', '600']
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '700']
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
  weight: ['500', '600', '700']
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant-garamond',
  weight: ['400', '500', '600']
});

const merriweather = Merriweather({
  subsets: ['latin'],
  variable: '--font-merriweather',
  weight: ['400', '700']
});

const baloo = Baloo_2({
  subsets: ['latin'],
  variable: '--font-baloo-2',
  weight: ['500', '700']
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700']
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '600', '700']
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ibm-plex-sans',
  weight: ['400', '500', '600']
});

export const metadata: Metadata = defaultMetadata();

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const gaId = process.env.GA_MEASUREMENT_ID;
  const theme = getActiveSiteTheme();
  const bodyStyle = theme.cssVars as CSSProperties;
  const siteSettings = await getPublicSiteSettings();
  const adsPublisherId = resolveAdPublisherId(siteSettings);
  const adsEnabled = siteSettings.adSlotsEnabled && (Boolean(adsPublisherId) || process.env.NODE_ENV !== 'production');
  const adsMode = siteSettings.adsMode || 'auto';
  const adsPreviewEnabled = process.env.NODE_ENV !== 'production' ? true : siteSettings.adsPreviewEnabled;

  const fontVars = [
    spaceGrotesk.variable,
    sora.variable,
    sourceSerif.variable,
    playfair.variable,
    cormorant.variable,
    merriweather.variable,
    baloo.variable,
    nunito.variable,
    manrope.variable,
    ibmPlexSans.variable
  ].join(' ');

  return (
    <html
      lang="en"
      className={fontVars}
      data-theme-recipe={theme.recipe}
      data-theme-tone={theme.tone}
      data-ads-enabled={adsEnabled ? 'true' : 'false'}
      data-ads-mode={adsMode}
      data-ads-preview-enabled={adsPreviewEnabled ? 'true' : 'false'}
      data-adsense-publisher={adsPublisherId}
      data-ads-slot-header={siteSettings.adsenseSlotHeader}
      data-ads-slot-in-content={siteSettings.adsenseSlotInContent}
      data-ads-slot-footer={siteSettings.adsenseSlotFooter}
      suppressHydrationWarning
    >
      <body style={bodyStyle} className="font-body antialiased [font-family:var(--font-body)]">
        {adsEnabled && adsPublisherId ? (
          <Script
            id="adsbygoogle-script"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsPublisherId)}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        ) : null}
        {adsEnabled && adsPublisherId && (adsMode === 'auto' || adsMode === 'hybrid') ? (
          <Script id="adsbygoogle-auto-ads-init" strategy="afterInteractive">
            {`window.adsbygoogle = window.adsbygoogle || [];
window.adsbygoogle.push({
  google_ad_client: '${adsPublisherId.replace(/'/g, "\\'")}',
  enable_page_level_ads: true
});`}
          </Script>
        ) : null}
        {gaId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        ) : null}
        <div className="min-h-screen">
          <SiteHeader />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          <SiteFooter />
        </div>
        <RouteLoadingOverlay />
      </body>
    </html>
  );
}
