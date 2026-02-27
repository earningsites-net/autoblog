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
  };
  niche?: {
    primaryNiche?: string;
    allowedSubtopics?: string[];
    excludedSubtopics?: string[];
  };
};

function candidateBlueprintPaths() {
  const cwd = process.cwd();
  const fromEnv = process.env.SITE_BLUEPRINT_PATH;

  return [
    fromEnv,
    path.resolve(cwd, 'sites/hammer-hearth/site.blueprint.json'),
    path.resolve(cwd, '../../sites/hammer-hearth/site.blueprint.json')
  ].filter(Boolean) as string[];
}

let cachedBlueprint: SiteBlueprintLite | null | undefined;

export function getSiteBlueprint(): SiteBlueprintLite | null {
  if (cachedBlueprint !== undefined) return cachedBlueprint;

  for (const filePath of candidateBlueprintPaths()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SiteBlueprintLite;
      if (parsed?.siteSlug && parsed?.brandName) {
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
