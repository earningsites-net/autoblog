import Link from 'next/link';
import { siteConfig } from '@web/lib/site';
import { getActiveSiteTheme } from '@web/lib/theme';

export function SiteFooter() {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;

  if (recipe === 'warm_wellness') {
    return (
      <footer className={theme.classes.footer}>
        <div className="h-1 w-full bg-gradient-to-r from-rose-300 via-pink-200 to-rose-300" />
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr_1fr]">
            <div>
              <p className="font-display text-3xl text-paper">{siteConfig.name}</p>
              <p className="mt-3 max-w-md text-sm leading-7 text-paper/78">
                Gentle, practical beauty and wellness guidance designed for consistent routines and measurable progress.
              </p>
            </div>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.18em] text-paper/70">Explore</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link href="/categories" className="hover:text-rose-300">Categories</Link></li>
                <li><Link href="/about" className="hover:text-rose-300">About</Link></li>
                <li><Link href="/contact" className="hover:text-rose-300">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.18em] text-paper/70">Policies</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link href="/privacy-policy" className="hover:text-rose-300">Privacy Policy</Link></li>
                <li><Link href="/cookie-policy" className="hover:text-rose-300">Cookie Policy</Link></li>
                <li><Link href="/disclaimer" className="hover:text-rose-300">Disclaimer</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-5 text-xs text-paper/60">
            <p>{new Date().getFullYear()} {siteConfig.name}. Informational content only.</p>
          </div>
        </div>
      </footer>
    );
  }

  if (recipe === 'technical_minimal') {
    return (
      <footer className={theme.classes.footer}>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 border-b border-white/10 pb-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <p className="font-display text-xl">{siteConfig.name}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-paper/75">
                Automated editorial pipeline with deterministic publishing and low-touch operations.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-paper/65">Explore</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/categories" className="hover:text-rust">Categories</Link></li>
                <li><Link href="/about" className="hover:text-rust">About</Link></li>
                <li><Link href="/contact" className="hover:text-rust">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-paper/65">Policies</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/privacy-policy" className="hover:text-rust">Privacy Policy</Link></li>
                <li><Link href="/cookie-policy" className="hover:text-rust">Cookie Policy</Link></li>
                <li><Link href="/disclaimer" className="hover:text-rust">Disclaimer</Link></li>
              </ul>
            </div>
          </div>
          <p className="pt-4 text-xs text-paper/60">{new Date().getFullYear()} {siteConfig.name}. Informational content only.</p>
        </div>
      </footer>
    );
  }

  if (recipe === 'editorial_luxury') {
    return (
      <footer className={theme.classes.footer}>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr]">
            <div>
              <p className="font-display text-3xl">{siteConfig.name}</p>
              <p className="mt-4 max-w-md text-sm leading-7 text-paper/75">
                Premium editorial automation designed for elegant, evergreen, and scalable content businesses.
              </p>
            </div>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.2em] text-paper/70">Explore</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link href="/categories" className="hover:text-rust">Categories</Link></li>
                <li><Link href="/about" className="hover:text-rust">About</Link></li>
                <li><Link href="/contact" className="hover:text-rust">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.2em] text-paper/70">Policies</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link href="/privacy-policy" className="hover:text-rust">Privacy Policy</Link></li>
                <li><Link href="/cookie-policy" className="hover:text-rust">Cookie Policy</Link></li>
                <li><Link href="/disclaimer" className="hover:text-rust">Disclaimer</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-5 text-xs text-paper/60">
            <p>{new Date().getFullYear()} {siteConfig.name}. Informational content only.</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={theme.classes.footer}>
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
