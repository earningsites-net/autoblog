import { getSiteBlueprint } from './site-blueprint';

const activeBlueprint = getSiteBlueprint();

export const siteConfig = {
  slug: activeBlueprint?.siteSlug || 'hammer-hearth',
  name: process.env.NEXT_PUBLIC_SITE_NAME || activeBlueprint?.brandName || 'Hammer & Hearth',
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
    activeBlueprint?.siteDescription ||
    'A practical lifestyle magazine with clear, evergreen guides, ideas, and inspiration for everyday living.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE || activeBlueprint?.locale || 'en-US',
  niche: activeBlueprint?.niche?.primaryNiche || 'Home & DIY',
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
