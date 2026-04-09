import path from 'node:path';
import type { NextConfig } from 'next';

const portalBaseUrl = String(process.env.NEXT_PUBLIC_PORTAL_BASE_URL || process.env.PORTAL_BASE_URL || '').replace(/\/$/, '');
const siteSlug = String(process.env.NEXT_PUBLIC_SITE_SLUG || process.env.SITE_SLUG || '').trim();

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  async redirects() {
    if (!portalBaseUrl || !siteSlug) {
      return [];
    }

    const destination = `${portalBaseUrl}/portal?siteSlug=${encodeURIComponent(siteSlug)}`;
    return [
      {
        source: '/portal',
        destination,
        permanent: false
      }
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  }
};

export default nextConfig;
