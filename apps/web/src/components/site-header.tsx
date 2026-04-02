import Link from 'next/link';
import { getSiteLogoMonogram, siteConfig } from '@web/lib/site';
import { getActiveSiteTheme } from '@web/lib/theme';

const nav = [
  { href: '/', label: 'Home' },
  { href: '/categories', label: 'Categories' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export function SiteHeader() {
  const theme = getActiveSiteTheme();
  const recipe = theme.recipe;
  const isNoirSharp = recipe === 'noir_luxury_dark';
  const isArcadeSoft = recipe === 'arcade_play_dark';
  const logoLetter = getSiteLogoMonogram().letter;
  const logoUrl = siteConfig.brandAssets.logoUrl;
  const logoAlt = siteConfig.brandAssets.logoAlt || `${siteConfig.name} logo`;

  if (recipe === 'editorial_luxury') {
    return (
      <header className={theme.classes.header}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center border border-black/20 bg-paper text-ink shadow-card">
              {logoUrl ? (
                <img src={logoUrl} alt={logoAlt} className="h-8 w-8 object-cover" />
              ) : (
                <span className="font-display text-xl font-semibold text-rust">{logoLetter}</span>
              )}
            </span>
            <span>
              <span className="block font-display text-xl leading-none text-ink">{siteConfig.name}</span>
              <span className="block text-[10px] uppercase tracking-[0.28em] text-ink/55">{siteConfig.niche}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-semibold uppercase tracking-[0.14em] md:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-ink/80 transition hover:text-rust">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    );
  }

  if (recipe === 'technical_minimal') {
    return (
      <header className={theme.classes.header}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-black/20 bg-coal text-paper">
              {logoUrl ? (
                <img src={logoUrl} alt={logoAlt} className="h-7 w-7 rounded-md object-cover" />
              ) : (
                <span className="font-display text-base font-semibold">{logoLetter}</span>
              )}
            </span>
            <span>
              <span className="block font-display text-base leading-none text-ink">{siteConfig.name}</span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-ink/55">{siteConfig.niche}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-[0.12em] md:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-ink/75 transition hover:text-rust">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    );
  }

  if (recipe === 'warm_wellness') {
    return (
      <header className={theme.classes.header}>
        <div className="border-b border-rose-200 bg-rose-50/80">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-900/70 sm:px-6 lg:px-8">
            <p>Beauty, skincare, and self-care reads for real routines</p>
            <Link href="/categories" className="inline-flex rounded-lg border border-rose-300 bg-rose-500 px-4 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white hover:bg-rose-600">
              Browse categories
            </Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-rose-300 bg-rose-50 text-ink shadow-card">
              {logoUrl ? (
                <img src={logoUrl} alt={logoAlt} className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="font-display text-lg font-semibold text-rose-500">{logoLetter}</span>
              )}
            </span>
            <span>
              <span className="block font-display text-lg leading-none text-ink">{siteConfig.name}</span>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-rose-900/55">{siteConfig.niche}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-5 text-[13px] font-semibold uppercase tracking-[0.14em] md:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-ink/75 transition hover:text-rose-500">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className={theme.classes.header}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center bg-coal text-paper shadow-card ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-lg' : 'rounded-2xl'}`}>
            {logoUrl ? (
              <img src={logoUrl} alt={logoAlt} className={`h-7 w-7 object-cover ${isNoirSharp ? '' : isArcadeSoft ? 'rounded-md' : 'rounded-xl'}`} />
            ) : (
              <span className="font-display text-lg font-bold text-rust">{logoLetter}</span>
            )}
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
