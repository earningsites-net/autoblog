import Link from 'next/link';
import { siteConfig } from '@web/lib/site';

const nav = [
  { href: '/', label: 'Home' },
  { href: '/categories', label: 'Categories' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-coal text-paper shadow-card">
            <span className="font-display text-lg font-bold text-rust">H</span>
          </span>
          <span>
            <span className="block font-display text-lg leading-none text-ink">{siteConfig.name}</span>
            <span className="block text-[10px] uppercase tracking-[0.25em] text-ink/60">{siteConfig.niche}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink/80 transition hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
