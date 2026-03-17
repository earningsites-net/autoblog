import type { SiteBlueprint } from '@autoblog/factory-sdk';

export const genericEditorialMagazineBlueprint: SiteBlueprint = {
  version: 1,
  siteSlug: 'editorial-starter',
  brandName: 'Editorial Starter',
  siteDescription:
    'A flexible editorial magazine template for focused, informational content across multiple niches.',
  businessMode: 'transfer_first',
  delivery: {
    handoffEnabled: true,
    managedEligible: true
  },
  opsDefaults: {
    publishEnabled: true,
    maxPublishesPerRun: 1,
    cadenceRules: [
      {
        label: 'Launch burst (1 per 3 minutes)',
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-01-02T00:00:00.000Z',
        maxPublishes: 1,
        perMinutes: 3
      },
      {
        label: 'Steady cadence (1 per day)',
        startAt: '2026-01-02T00:00:00.000Z',
        endAt: null,
        maxPublishes: 1,
        perDays: 1
      }
    ]
  },
  locale: 'en-US',
  theme: {
    palette: {
      paper: '#F6F1E9',
      ink: '#1F1B16',
      rust: '#E08748',
      sage: '#829975',
      coal: '#221F1B'
    },
    typography: {
      headingFont: 'Sora',
      bodyFont: 'Source Serif 4'
    },
    visualStyle: 'clean editorial magazine layout with adaptable visual language'
  },
  themeProfile: {
    tone: 'editorial',
    recipe: 'bold_magazine',
    layoutDensity: 'balanced',
    cardStyle: 'mixed',
    accentIntensity: 'medium',
    backgroundStyle: 'gradient'
  },
  niche: {
    primaryNiche: 'Editorial Magazine',
    allowedSubtopics: [
      'Core coverage topics',
      'Practical guides',
      'Analysis and commentary',
      'Examples and use cases',
      'Tools, platforms, or entities relevant to the niche'
    ],
    excludedSubtopics: [
      'Medical advice',
      'Legal advice',
      'Financial advice',
      'Dangerous how-to instructions',
      'Invented facts or unsupported claims'
    ],
    scopeNotes: ['Informational only', 'No unsupported claims', 'Adapt output to the configured niche prompt'],
    disclaimerVariants: ['general', 'safety']
  },
  categories: [
    {
      slug: 'core-topics',
      title: 'Core Topics',
      description: 'Foundational coverage of the main subject areas for the publication.',
      accent: 'rust'
    },
    {
      slug: 'practical-guides',
      title: 'Practical Guides',
      description: 'Actionable explainers, walkthroughs, and reader-friendly how-to content.',
      accent: 'sage'
    },
    {
      slug: 'analysis-insights',
      title: 'Analysis & Insights',
      description: 'Interpretation, commentary, comparisons, and forward-looking perspectives.',
      accent: 'rust'
    }
  ],
  seedTopics: [
    'foundational concepts explained',
    'practical guide for beginners',
    'common mistakes and best practices',
    'trends and developments overview'
  ],
  budgetPolicy: {
    monthlyCapUsd: 100,
    publishQuota: {
      minPerDay: 4,
      maxPerDay: 8,
      topicCandidatesPerDay: 20
    },
    thresholds: {
      normalMaxRatio: 0.6,
      economyMaxRatio: 0.85,
      throttleMaxRatio: 1.0
    }
  },
  promptPresetVersions: {
    topicDiscovery: 'topic-discovery-v1',
    briefGeneration: 'brief-generation-v1',
    articleGeneration: 'article-generation-v1',
    imageGeneration: 'image-generation-v1',
    qaScoring: 'qa-scoring-v1'
  },
  publishingTarget: {
    kind: 'sanity',
    dataset: 'production',
    apiVersion: '2025-01-01'
  },
  deploymentTarget: {
    kind: 'vercel'
  },
  legalTemplates: {
    privacyTemplate: 'mvp-standard-v1',
    cookieTemplate: 'mvp-standard-v1',
    disclaimerTemplate: 'home-diy-informational-v1',
    contactEmailPlaceholder: 'hello@example.com'
  },
  providerRefs: {
    textProviderKeyRef: 'OPENAI_API_KEY',
    imageProviderKeyRef: 'REPLICATE_API_TOKEN',
    cmsReadKeyRef: 'SANITY_READ_TOKEN',
    cmsWriteKeyRef: 'SANITY_WRITE_TOKEN'
  },
  prepopulate: {
    targetPublishedCount: 24,
    batchSize: 3,
    mode: 'bulk_direct',
    maxRunMinutes: 90,
    maxCostUsd: 15
  },
  publishing: {
    strategy: 'steady_scheduled',
    timezone: 'Europe/Rome',
    revalidateEnabled: true,
    revalidateContinueOnFail: true,
    maxPublishesPerRun: 1,
    cadenceRules: [
      {
        label: 'Launch burst (1 per 3 minutes)',
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-01-02T00:00:00.000Z',
        maxPublishes: 1,
        perMinutes: 3
      },
      {
        label: 'Steady cadence (1 per day)',
        startAt: '2026-01-02T00:00:00.000Z',
        endAt: null,
        maxPublishes: 1,
        perDays: 1
      }
    ]
  },
  featureFlags: {
    adSlotsDefault: false
  }
};

export const homeDiyMagazineBlueprint: SiteBlueprint = {
  version: 1,
  siteSlug: 'hammer-hearth',
  brandName: 'Hammer & Hearth',
  siteDescription:
    'AI-assisted Home & DIY magazine featuring practical, evergreen guides for organization, maintenance, decor, and seasonal prep.',
  businessMode: 'transfer_first',
  delivery: {
    handoffEnabled: true,
    managedEligible: true
  },
  opsDefaults: {
    publishEnabled: true,
    maxPublishesPerRun: 1,
    cadenceRules: [
      {
        label: 'Launch burst (1 per 3 minutes)',
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-01-02T00:00:00.000Z',
        maxPublishes: 1,
        perMinutes: 3
      },
      {
        label: 'Steady cadence (1 per day)',
        startAt: '2026-01-02T00:00:00.000Z',
        endAt: null,
        maxPublishes: 1,
        perDays: 1
      }
    ]
  },
  locale: 'en-US',
  theme: {
    palette: {
      paper: '#F6F1E9',
      ink: '#1F1B16',
      rust: '#E08748',
      sage: '#829975',
      coal: '#221F1B'
    },
    typography: {
      headingFont: 'Sora',
      bodyFont: 'Source Serif 4'
    },
    visualStyle: 'warm-industrial magazine editorial'
  },
  themeProfile: {
    tone: 'editorial',
    recipe: 'bold_magazine',
    layoutDensity: 'balanced',
    cardStyle: 'mixed',
    accentIntensity: 'medium',
    backgroundStyle: 'gradient'
  },
  niche: {
    primaryNiche: 'Home & DIY',
    allowedSubtopics: [
      'Home organization',
      'Cleaning & maintenance basics',
      'Decor ideas',
      'Gardening basics',
      'Tool care and beginner tips',
      'Seasonal home prep checklists'
    ],
    excludedSubtopics: [
      'Electrical work',
      'Structural engineering',
      'Plumbing advanced repairs',
      'Health/medical claims',
      'Legal/financial advice'
    ],
    scopeNotes: ['Informational only', 'No YMYL topics', 'Beginner-safe framing'],
    disclaimerVariants: ['general', 'safety']
  },
  categories: [
    {
      slug: 'home-organization',
      title: 'Home Organization',
      description: 'Decluttering systems, storage ideas, and realistic routines that keep spaces usable.',
      accent: 'rust'
    },
    {
      slug: 'cleaning-maintenance',
      title: 'Cleaning & Maintenance',
      description: 'Simple upkeep guides, seasonal cleaning plans, and easy maintenance checklists.',
      accent: 'sage'
    },
    {
      slug: 'garden-basics',
      title: 'Garden Basics',
      description: 'Beginner-friendly garden planning, small-space ideas, and seasonal plant care basics.',
      accent: 'sage'
    }
  ],
  seedTopics: [
    'entryway organization ideas',
    'weekly kitchen reset routine',
    'spring patio cleanup checklist',
    'raised bed layout tips for beginners'
  ],
  budgetPolicy: {
    monthlyCapUsd: 100,
    publishQuota: {
      minPerDay: 4,
      maxPerDay: 8,
      topicCandidatesPerDay: 20
    },
    thresholds: {
      normalMaxRatio: 0.6,
      economyMaxRatio: 0.85,
      throttleMaxRatio: 1.0
    }
  },
  promptPresetVersions: {
    topicDiscovery: 'topic-discovery-v1',
    briefGeneration: 'brief-generation-v1',
    articleGeneration: 'article-generation-v1',
    imageGeneration: 'image-generation-v1',
    qaScoring: 'qa-scoring-v1'
  },
  publishingTarget: {
    kind: 'sanity',
    dataset: 'production',
    apiVersion: '2025-01-01'
  },
  deploymentTarget: {
    kind: 'vercel'
  },
  legalTemplates: {
    privacyTemplate: 'mvp-standard-v1',
    cookieTemplate: 'mvp-standard-v1',
    disclaimerTemplate: 'home-diy-informational-v1',
    contactEmailPlaceholder: 'hello@example.com'
  },
  providerRefs: {
    textProviderKeyRef: 'OPENAI_API_KEY',
    imageProviderKeyRef: 'REPLICATE_API_TOKEN',
    cmsReadKeyRef: 'SANITY_READ_TOKEN',
    cmsWriteKeyRef: 'SANITY_WRITE_TOKEN'
  },
  prepopulate: {
    targetPublishedCount: 24,
    batchSize: 3,
    mode: 'bulk_direct',
    maxRunMinutes: 90,
    maxCostUsd: 15
  },
  publishing: {
    strategy: 'steady_scheduled',
    timezone: 'Europe/Rome',
    revalidateEnabled: true,
    revalidateContinueOnFail: true,
    maxPublishesPerRun: 1,
    cadenceRules: [
      {
        label: 'Launch burst (1 per 3 minutes)',
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-01-02T00:00:00.000Z',
        maxPublishes: 1,
        perMinutes: 3
      },
      {
        label: 'Steady cadence (1 per day)',
        startAt: '2026-01-02T00:00:00.000Z',
        endAt: null,
        maxPublishes: 1,
        perDays: 1
      }
    ]
  },
  featureFlags: {
    adSlotsDefault: false
  }
};

export const blueprintTemplates = {
  'generic-editorial-magazine': genericEditorialMagazineBlueprint,
  'home-diy-magazine': homeDiyMagazineBlueprint
} as const;

export type BlueprintTemplateId = keyof typeof blueprintTemplates;

export function listBlueprintTemplateIds(): BlueprintTemplateId[] {
  return Object.keys(blueprintTemplates) as BlueprintTemplateId[];
}

export function getBlueprintTemplate(id: BlueprintTemplateId): SiteBlueprint {
  return structuredClone(blueprintTemplates[id]);
}

export function instantiateBlueprint(id: BlueprintTemplateId, siteSlug: string, brandName?: string): SiteBlueprint {
  const blueprint = getBlueprintTemplate(id);
  blueprint.siteSlug = siteSlug;
  if (brandName) {
    blueprint.brandName = brandName;
  }
  return blueprint;
}
