import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { Sora, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@web/components/site-header';
import { SiteFooter } from '@web/components/site-footer';
import { defaultMetadata } from '@web/lib/seo';

const display = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700']
});

const body = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600']
});

export const metadata: Metadata = defaultMetadata();

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const gaId = process.env.GA_MEASUREMENT_ID;

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body antialiased [font-family:var(--font-body)]">
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
      </body>
    </html>
  );
}
