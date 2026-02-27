import Link from 'next/link';
import { siteConfig } from '@web/lib/site';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-black/5 bg-coal text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.25fr_1fr_1fr] lg:px-8">
        <div>
          <p className="font-display text-2xl">{siteConfig.name}</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-paper/75">
            AI-assisted editorial publishing for practical, everyday {siteConfig.niche} content. Built for scalable automation,
            clean UX, and ad-ready monetization.
          </p>
        </div>
        <div>
          <p className="font-display text-sm uppercase tracking-[0.18em] text-paper/70">Explore</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/categories" className="hover:text-rust">Categories</Link></li>
            <li><Link href="/about" className="hover:text-rust">About</Link></li>
            <li><Link href="/contact" className="hover:text-rust">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-display text-sm uppercase tracking-[0.18em] text-paper/70">Policies</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/privacy-policy" className="hover:text-rust">Privacy Policy</Link></li>
            <li><Link href="/cookie-policy" className="hover:text-rust">Cookie Policy</Link></li>
            <li><Link href="/disclaimer" className="hover:text-rust">Disclaimer</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-paper/60 sm:px-6 lg:px-8">
        <p>{new Date().getFullYear()} {siteConfig.name}. Informational content only.</p>
      </div>
    </footer>
  );
}
