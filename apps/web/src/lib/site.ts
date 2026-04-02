import { getConfiguredSiteSlug, getSiteBlueprint } from './site-blueprint';

const activeBlueprint = getSiteBlueprint();
const configuredSiteSlug = getConfiguredSiteSlug();
const resolvedSiteSlug = activeBlueprint?.siteSlug || configuredSiteSlug;

if (process.env.NODE_ENV === 'production' && !resolvedSiteSlug) {
  throw new Error(
    'Site slug is not configured. Set SITE_SLUG or NEXT_PUBLIC_SITE_SLUG in the runtime environment.'
  );
}

export const siteConfig = {
  slug: resolvedSiteSlug,
  name: process.env.NEXT_PUBLIC_SITE_NAME || activeBlueprint?.brandName || 'AutoBlog',
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
    activeBlueprint?.siteDescription ||
    'Automated editorial site.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE || activeBlueprint?.locale || 'en-US',
  niche: activeBlueprint?.niche?.primaryNiche || '',
  budgetPolicy: activeBlueprint?.budgetPolicy,
  categories: activeBlueprint?.categories || [],
  themePalette: activeBlueprint?.theme?.palette || {},
  themeProfile: activeBlueprint?.themeProfile,
  brandAssets: {
    logoUrl: process.env.NEXT_PUBLIC_SITE_LOGO_URL || activeBlueprint?.brandAssets?.logoUrl || '',
    logoAlt: process.env.NEXT_PUBLIC_SITE_LOGO_ALT || activeBlueprint?.brandAssets?.logoAlt || '',
    heroImageUrl: process.env.NEXT_PUBLIC_HOME_HERO_IMAGE_URL || activeBlueprint?.brandAssets?.heroImageUrl || '',
    heroImageAlt: process.env.NEXT_PUBLIC_HOME_HERO_IMAGE_ALT || activeBlueprint?.brandAssets?.heroImageAlt || ''
  },
  defaultOgImage:
    'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80'
} as const;

export type SiteLogoMonogram = {
  letter: string;
  background: string;
  foreground: string;
  border: string;
  radius: number;
};

export const featureFlags = {
  adSlots:
    process.env.ENABLE_AD_SLOTS !== undefined
      ? process.env.ENABLE_AD_SLOTS === 'true'
      : true
};

export function absoluteUrl(path = '/') {
  const base = siteConfig.url.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
}

export function estimateReadingTime(wordCount: number) {
  return Math.max(1, Math.round(wordCount / 220));
}

export function getActiveSiteBlueprint() {
  return activeBlueprint;
}

export function getSiteLogoMonogram(): SiteLogoMonogram {
  const palette = siteConfig.themePalette || {};
  const recipe = siteConfig.themeProfile?.recipe || 'bold_magazine';
  const letter = String(siteConfig.name || '').trim().charAt(0).toUpperCase() || 'A';
  const paper = String(palette.paper || '#F6F1E9');
  const ink = String(palette.ink || '#1F1B16');
  const rust = String(palette.rust || '#E08748');
  const coal = String(palette.coal || '#221F1B');

  if (recipe === 'editorial_luxury') {
    return {
      letter,
      background: paper,
      foreground: rust,
      border: ink,
      radius: 10
    };
  }

  if (recipe === 'technical_minimal') {
    return {
      letter,
      background: coal,
      foreground: paper,
      border: ink,
      radius: 10
    };
  }

  if (recipe === 'warm_wellness') {
    return {
      letter,
      background: paper,
      foreground: rust,
      border: rust,
      radius: 32
    };
  }

  return {
    letter,
    background: coal,
    foreground: rust,
    border: paper,
    radius: recipe === 'arcade_play_dark' ? 12 : recipe === 'noir_luxury_dark' ? 6 : 16
  };
}
