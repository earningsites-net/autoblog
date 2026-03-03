import { getSiteBlueprint } from './site-blueprint';

type ThemeRecipe =
  | 'bold_magazine'
  | 'editorial_luxury'
  | 'warm_wellness'
  | 'playful_kids'
  | 'technical_minimal'
  | 'noir_luxury_dark'
  | 'midnight_wellness_dark'
  | 'arcade_play_dark';
type ThemeTone = 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';

type ThemeClasses = {
  header: string;
  footer: string;
  pageHero: string;
  heroGrid: string;
  articleCard: string;
  categoryGrid: string;
  categoryCard: string;
  primaryButton: string;
  secondaryButton: string;
};

type SiteThemeRuntime = {
  recipe: ThemeRecipe;
  tone: ThemeTone;
  isDark: boolean;
  cssVars: Record<string, string>;
  classes: ThemeClasses;
};

const DEFAULT_PALETTE = {
  paper: '#F4EEE3',
  ink: '#201A15',
  rust: '#CE6A32',
  sage: '#5F8E79',
  coal: '#2C2520'
};

const FONT_VARIABLES: Record<string, string> = {
  'Space Grotesk': 'var(--font-space-grotesk)',
  Sora: 'var(--font-sora)',
  'Playfair Display': 'var(--font-playfair-display)',
  'Cormorant Garamond': 'var(--font-cormorant-garamond)',
  Merriweather: 'var(--font-merriweather)',
  'Baloo 2': 'var(--font-baloo-2)',
  Nunito: 'var(--font-nunito)',
  Manrope: 'var(--font-manrope)',
  'IBM Plex Sans': 'var(--font-ibm-plex-sans)',
  'Source Serif 4': 'var(--font-source-serif-4)'
};

const RECIPE_CLASSES: Record<ThemeRecipe, ThemeClasses> = {
  bold_magazine: {
    header: 'sticky top-0 z-40 border-b border-black/5 bg-paper/90 backdrop-blur',
    footer: 'mt-24 border-t border-black/5 bg-coal text-paper',
    pageHero: 'relative overflow-hidden rounded-[2rem] border border-black/5 bg-white p-8 shadow-card sm:p-10',
    heroGrid: 'grid gap-6 lg:grid-cols-[1.45fr_1fr]',
    articleCard: 'group overflow-hidden rounded-3xl border border-black/5 bg-white shadow-card',
    categoryGrid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
    categoryCard: 'group relative overflow-hidden rounded-3xl border border-black/5 bg-white p-6 shadow-card transition hover:-translate-y-0.5',
    primaryButton: 'inline-flex rounded-full bg-coal px-5 py-3 text-sm font-medium text-paper hover:bg-coal/90',
    secondaryButton: 'inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-ink hover:border-black/20'
  },
  editorial_luxury: {
    header: 'sticky top-0 z-40 border-b border-black/10 bg-paper/95 backdrop-blur-xl',
    footer: 'mt-24 border-t border-black/10 bg-coal text-paper',
    pageHero: 'relative overflow-hidden border border-black/10 bg-white/95 p-10 shadow-card sm:p-12',
    heroGrid: 'grid gap-6 xl:grid-cols-[1.55fr_1fr]',
    articleCard: 'group overflow-hidden border border-black/10 bg-white shadow-card',
    categoryGrid: 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3',
    categoryCard: 'group relative overflow-hidden border border-black/10 bg-white p-7 shadow-card transition hover:-translate-y-0.5',
    primaryButton: 'inline-flex rounded-none bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-ink/90',
    secondaryButton: 'inline-flex rounded-none border border-black/20 bg-white px-5 py-3 text-sm font-medium text-ink hover:border-black/35'
  },
  warm_wellness: {
    header: 'sticky top-0 z-40 border-b border-rose-200 bg-rose-50/80 backdrop-blur',
    footer: 'mt-24 border-t border-rose-300/60 bg-[#140d12] text-paper',
    pageHero: 'relative overflow-hidden rounded-xl border border-rose-200 bg-white p-8 shadow-card sm:p-11',
    heroGrid: 'grid gap-6 lg:grid-cols-[1.35fr_1fr]',
    articleCard: 'group overflow-hidden rounded-xl border border-rose-200 bg-white shadow-card',
    categoryGrid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
    categoryCard: 'group relative overflow-hidden rounded-xl border border-rose-200 bg-white p-6 shadow-card transition hover:-translate-y-0.5',
    primaryButton: 'inline-flex rounded-lg bg-rose-500 px-5 py-3 text-sm font-medium text-white hover:bg-rose-600',
    secondaryButton: 'inline-flex rounded-lg border border-rose-300 bg-white px-5 py-3 text-sm font-medium text-ink hover:border-rose-400'
  },
  playful_kids: {
    header: 'sticky top-0 z-40 border-b border-rust/15 bg-paper/95 backdrop-blur',
    footer: 'mt-24 border-t border-rust/20 bg-coal text-paper',
    pageHero: 'relative overflow-hidden rounded-[2.4rem] border-2 border-rust/20 bg-white p-8 shadow-card sm:p-10',
    heroGrid: 'grid gap-6 lg:grid-cols-[1.3fr_1fr]',
    articleCard: 'group overflow-hidden rounded-[2.05rem] border-2 border-black/5 bg-white shadow-card',
    categoryGrid: 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
    categoryCard: 'group relative overflow-hidden rounded-[2rem] border-2 border-rust/20 bg-white p-6 shadow-card transition hover:-translate-y-1',
    primaryButton: 'inline-flex rounded-full bg-rust px-5 py-3 text-sm font-medium text-paper hover:bg-rust/90',
    secondaryButton: 'inline-flex rounded-full border-2 border-rust/25 bg-white px-5 py-3 text-sm font-medium text-ink hover:border-rust/45'
  },
  technical_minimal: {
    header: 'sticky top-0 z-40 border-b border-black/10 bg-paper/90 backdrop-blur',
    footer: 'mt-24 border-t border-black/10 bg-coal text-paper',
    pageHero: 'relative overflow-hidden rounded-2xl border border-black/10 bg-white p-7 shadow-card sm:p-9',
    heroGrid: 'grid gap-5 xl:grid-cols-[1.5fr_1fr]',
    articleCard: 'group overflow-hidden rounded-xl border border-black/10 bg-white shadow-card',
    categoryGrid: 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
    categoryCard: 'group relative overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-card transition hover:-translate-y-0.5',
    primaryButton: 'inline-flex rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-ink/90',
    secondaryButton: 'inline-flex rounded-md border border-black/20 bg-white px-5 py-3 text-sm font-medium text-ink hover:border-black/35'
  },
  noir_luxury_dark: {
    header: 'sticky top-0 z-40 border-b border-white/10 bg-coal/90 backdrop-blur-xl',
    footer: 'mt-24 border-t border-white/10 bg-black text-paper',
    pageHero: 'relative overflow-hidden border border-white/15 bg-coal/80 p-10 shadow-[0_28px_70px_-36px_rgba(0,0,0,0.75)] sm:p-12',
    heroGrid: 'grid gap-6 xl:grid-cols-[1.55fr_1fr]',
    articleCard: 'group overflow-hidden border border-white/15 bg-coal/75 shadow-[0_22px_60px_-34px_rgba(0,0,0,0.75)]',
    categoryGrid: 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3',
    categoryCard: 'group relative overflow-hidden border border-white/15 bg-coal/75 p-7 shadow-[0_22px_60px_-34px_rgba(0,0,0,0.75)] transition hover:-translate-y-0.5',
    primaryButton: 'inline-flex bg-rust px-5 py-3 text-sm font-medium text-paper hover:bg-rust/90',
    secondaryButton: 'inline-flex border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-paper hover:border-white/45'
  },
  midnight_wellness_dark: {
    header: 'sticky top-0 z-40 border-b border-sage/25 bg-coal/90 backdrop-blur',
    footer: 'mt-24 border-t border-sage/20 bg-black text-paper',
    pageHero: 'relative overflow-hidden rounded-[2.2rem] border border-sage/30 bg-coal/80 p-9 shadow-[0_24px_65px_-34px_rgba(0,0,0,0.72)] sm:p-11',
    heroGrid: 'grid gap-6 lg:grid-cols-[1.35fr_1fr]',
    articleCard: 'group overflow-hidden rounded-[1.9rem] border border-sage/30 bg-coal/75 shadow-[0_24px_55px_-32px_rgba(0,0,0,0.72)]',
    categoryGrid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
    categoryCard: 'group relative overflow-hidden rounded-[1.9rem] border border-sage/28 bg-coal/75 p-6 shadow-[0_24px_55px_-32px_rgba(0,0,0,0.72)] transition hover:-translate-y-0.5',
    primaryButton: 'inline-flex rounded-full bg-sage px-5 py-3 text-sm font-medium text-paper hover:bg-sage/90',
    secondaryButton: 'inline-flex rounded-full border border-sage/40 bg-white/5 px-5 py-3 text-sm font-medium text-paper hover:border-sage/60'
  },
  arcade_play_dark: {
    header: 'sticky top-0 z-40 border-b border-rust/25 bg-coal/90 backdrop-blur',
    footer: 'mt-24 border-t border-rust/25 bg-black text-paper',
    pageHero: 'relative overflow-hidden rounded-xl border-2 border-rust/40 bg-coal/80 p-8 shadow-[0_24px_62px_-30px_rgba(0,0,0,0.74)] sm:p-10',
    heroGrid: 'grid gap-6 lg:grid-cols-[1.3fr_1fr]',
    articleCard: 'group overflow-hidden rounded-xl border-2 border-rust/35 bg-coal/75 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.74)]',
    categoryGrid: 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
    categoryCard: 'group relative overflow-hidden rounded-xl border-2 border-rust/35 bg-coal/75 p-6 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.74)] transition hover:-translate-y-1',
    primaryButton: 'inline-flex rounded-lg bg-rust px-5 py-3 text-sm font-medium text-paper hover:bg-rust/90',
    secondaryButton: 'inline-flex rounded-lg border-2 border-rust/45 bg-white/5 px-5 py-3 text-sm font-medium text-paper hover:border-rust/65'
  }
};

const DARK_RECIPES = new Set<ThemeRecipe>(['noir_luxury_dark', 'midnight_wellness_dark', 'arcade_play_dark']);

function hexToRgbTriplet(hexColor: string) {
  const normalized = String(hexColor || '').trim().replace('#', '');
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return null;
  const intValue = Number.parseInt(normalized, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `${r} ${g} ${b}`;
}

function validRecipe(input: unknown): ThemeRecipe {
  const value = String(input || '');
  if (value in RECIPE_CLASSES) return value as ThemeRecipe;
  return 'bold_magazine';
}

function validTone(input: unknown): ThemeTone {
  const value = String(input || '');
  if (['editorial', 'luxury', 'wellness', 'playful', 'technical'].includes(value)) {
    return value as ThemeTone;
  }
  return 'editorial';
}

function resolveFontVariable(fontName: unknown, fallback: string) {
  const mapped = FONT_VARIABLES[String(fontName || '').trim()];
  return mapped || fallback;
}

function buildActiveSiteTheme(): SiteThemeRuntime {
  const blueprint = getSiteBlueprint();
  const recipe = validRecipe(blueprint?.themeProfile?.recipe);
  const tone = validTone(blueprint?.themeProfile?.tone);
  const classes = RECIPE_CLASSES[recipe];

  const palette = {
    paper: blueprint?.theme?.palette?.paper || DEFAULT_PALETTE.paper,
    ink: blueprint?.theme?.palette?.ink || DEFAULT_PALETTE.ink,
    rust: blueprint?.theme?.palette?.rust || DEFAULT_PALETTE.rust,
    sage: blueprint?.theme?.palette?.sage || DEFAULT_PALETTE.sage,
    coal: blueprint?.theme?.palette?.coal || DEFAULT_PALETTE.coal
  };

  const cssVars: Record<string, string> = {
    '--paper': hexToRgbTriplet(palette.paper) || hexToRgbTriplet(DEFAULT_PALETTE.paper) || '244 238 227',
    '--ink': hexToRgbTriplet(palette.ink) || hexToRgbTriplet(DEFAULT_PALETTE.ink) || '32 26 21',
    '--rust': hexToRgbTriplet(palette.rust) || hexToRgbTriplet(DEFAULT_PALETTE.rust) || '206 106 50',
    '--sage': hexToRgbTriplet(palette.sage) || hexToRgbTriplet(DEFAULT_PALETTE.sage) || '95 142 121',
    '--coal': hexToRgbTriplet(palette.coal) || hexToRgbTriplet(DEFAULT_PALETTE.coal) || '44 37 32',
    '--font-display': resolveFontVariable(blueprint?.theme?.typography?.headingFont, 'var(--font-space-grotesk)'),
    '--font-body': resolveFontVariable(blueprint?.theme?.typography?.bodyFont, 'var(--font-source-serif-4)')
  };

  return {
    recipe,
    tone,
    isDark: DARK_RECIPES.has(recipe),
    cssVars,
    classes
  };
}

const activeSiteTheme = buildActiveSiteTheme();

export function getActiveSiteTheme() {
  return activeSiteTheme;
}
