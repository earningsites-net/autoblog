import fs from 'node:fs';
import path from 'node:path';

type BlueprintCategory = {
  slug: string;
  title: string;
  description: string;
  accent: 'rust' | 'sage';
};

type SiteBlueprintLite = {
  siteSlug: string;
  brandName: string;
  siteDescription?: string;
  locale?: string;
  categories?: BlueprintCategory[];
  seedTopics?: string[];
  budgetPolicy?: {
    monthlyCapUsd?: number;
    publishQuota?: {
      minPerDay?: number;
      maxPerDay?: number;
      topicCandidatesPerDay?: number;
    };
  };
  featureFlags?: {
    adSlotsDefault?: boolean;
  };
  theme?: {
    palette?: Partial<Record<'paper' | 'ink' | 'rust' | 'sage' | 'coal', string>>;
    typography?: {
      headingFont?: string;
      bodyFont?: string;
    };
    visualStyle?: string;
  };
  brandAssets?: {
    logoUrl?: string;
    logoAlt?: string;
    heroImageUrl?: string;
    heroImageAlt?: string;
  };
  themeProfile?: {
    tone?: 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
    recipe?:
      | 'bold_magazine'
      | 'editorial_luxury'
      | 'warm_wellness'
      | 'playful_kids'
      | 'technical_minimal'
      | 'noir_luxury_dark'
      | 'midnight_wellness_dark'
      | 'arcade_play_dark';
    layoutDensity?: 'airy' | 'balanced' | 'compact';
    cardStyle?: 'soft' | 'sharp' | 'mixed';
    accentIntensity?: 'soft' | 'medium' | 'vivid';
    backgroundStyle?: 'grain' | 'gradient' | 'pattern';
  };
  niche?: {
    primaryNiche?: string;
    allowedSubtopics?: string[];
    excludedSubtopics?: string[];
  };
  uiCopy?: Record<string, unknown>;
};

function normalizeSiteSlug(value: string | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getConfiguredSiteSlug() {
  return normalizeSiteSlug(
    process.env.SITE_SLUG ||
      process.env.NEXT_PUBLIC_SITE_SLUG ||
      process.env.SANITY_STUDIO_SITE_SLUG
  );
}

function candidateBlueprintPaths() {
  const cwd = process.cwd();
  const fromEnv = String(process.env.SITE_BLUEPRINT_PATH || '').trim();
  const envResolved = fromEnv ? path.resolve(cwd, fromEnv) : '';
  const slug = getConfiguredSiteSlug();
  const bySlugRoot = slug ? path.resolve(cwd, `sites/${slug}/site.blueprint.json`) : '';
  const bySlugMonorepo = slug ? path.resolve(cwd, `../../sites/${slug}/site.blueprint.json`) : '';

  return Array.from(
    new Set(
      [fromEnv, envResolved, bySlugRoot, bySlugMonorepo].filter(Boolean)
    )
  );
}

let cachedBlueprint: SiteBlueprintLite | null | undefined;

export function getSiteBlueprint(): SiteBlueprintLite | null {
  if (cachedBlueprint !== undefined) return cachedBlueprint;

  const expectedSlug = getConfiguredSiteSlug();

  for (const filePath of candidateBlueprintPaths()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SiteBlueprintLite;
      if (parsed?.siteSlug && parsed?.brandName) {
        const parsedSlug = normalizeSiteSlug(parsed.siteSlug);
        if (expectedSlug && parsedSlug && parsedSlug !== expectedSlug) {
          continue;
        }
        cachedBlueprint = parsed;
        return parsed;
      }
    } catch {
      // continue trying candidates
    }
  }

  cachedBlueprint = null;
  return null;
}

export function resetSiteBlueprintCacheForTests() {
  cachedBlueprint = undefined;
}
