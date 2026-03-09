import { z } from 'zod';

export const categorySeedSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  accent: z.enum(['rust', 'sage'])
});

const publishingTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('sanity'),
    projectId: z.string().min(1).optional(),
    dataset: z.string().min(1),
    apiVersion: z.string().min(1)
  }),
  z.object({
    kind: z.literal('wordpress'),
    baseUrl: z.string().min(1).optional(),
    authStrategy: z.enum(['application-password', 'jwt', 'oauth'])
  }),
  z.object({
    kind: z.literal('directus'),
    baseUrl: z.string().min(1).optional(),
    collection: z.string().min(1).optional()
  })
]);

const deploymentTargetSchema = z.object({
  kind: z.enum(['vercel', 'netlify', 'none']),
  projectName: z.string().min(1).optional(),
  teamScope: z.string().min(1).optional()
});

const themeProfileSchema = z.object({
  tone: z.enum(['editorial', 'luxury', 'wellness', 'playful', 'technical']),
  recipe: z.enum([
    'bold_magazine',
    'editorial_luxury',
    'warm_wellness',
    'playful_kids',
    'technical_minimal',
    'noir_luxury_dark',
    'midnight_wellness_dark',
    'arcade_play_dark'
  ]),
  layoutDensity: z.enum(['airy', 'balanced', 'compact']),
  cardStyle: z.enum(['soft', 'sharp', 'mixed']),
  accentIntensity: z.enum(['soft', 'medium', 'vivid']),
  backgroundStyle: z.enum(['grain', 'gradient', 'pattern'])
});

export const siteBlueprintSchema = z.object({
  version: z.number().int().positive(),
  siteSlug: z.string().min(1),
  brandName: z.string().min(1),
  siteDescription: z.string().min(1),
  businessMode: z.enum(['transfer_first', 'managed']).optional().default('transfer_first'),
  delivery: z.object({
    handoffEnabled: z.boolean(),
    managedEligible: z.boolean()
  }).optional().default({
    handoffEnabled: true,
    managedEligible: true
  }),
  opsDefaults: z.object({
    publishEnabled: z.boolean(),
    maxPublishesPerRun: z.number().int().positive(),
    cadenceRules: z.array(z.object({
      label: z.string().optional(),
      startAt: z.string().nullable().optional(),
      endAt: z.string().nullable().optional(),
      maxPublishes: z.number().int().positive(),
      perMinutes: z.number().int().positive().optional(),
      perDays: z.number().int().positive().optional()
    })).default([])
  }).optional().default({
    publishEnabled: true,
    maxPublishesPerRun: 1,
    cadenceRules: []
  }),
  locale: z.string().min(2),
  theme: z.object({
    palette: z.object({
      paper: z.string(),
      ink: z.string(),
      rust: z.string(),
      sage: z.string(),
      coal: z.string()
    }),
    typography: z.object({
      headingFont: z.string(),
      bodyFont: z.string()
    }),
    visualStyle: z.string()
  }),
  themeProfile: themeProfileSchema.optional().default({
    tone: 'editorial',
    recipe: 'bold_magazine',
    layoutDensity: 'balanced',
    cardStyle: 'mixed',
    accentIntensity: 'medium',
    backgroundStyle: 'gradient'
  }),
  niche: z.object({
    primaryNiche: z.string(),
    allowedSubtopics: z.array(z.string()),
    excludedSubtopics: z.array(z.string()),
    scopeNotes: z.array(z.string()).optional(),
    disclaimerVariants: z.array(z.enum(['general', 'safety']))
  }),
  categories: z.array(categorySeedSchema).min(1),
  seedTopics: z.array(z.string()).min(1),
  budgetPolicy: z.object({
    monthlyCapUsd: z.number().positive(),
    publishQuota: z.object({
      minPerDay: z.number().int().nonnegative(),
      maxPerDay: z.number().int().positive(),
      topicCandidatesPerDay: z.number().int().positive()
    }),
    thresholds: z.object({
      normalMaxRatio: z.number().min(0).max(1),
      economyMaxRatio: z.number().min(0).max(1),
      throttleMaxRatio: z.number().min(0).max(1)
    })
  }),
  promptPresetVersions: z.object({
    topicDiscovery: z.string(),
    briefGeneration: z.string(),
    articleGeneration: z.string(),
    imageGeneration: z.string(),
    qaScoring: z.string()
  }),
  publishingTarget: publishingTargetSchema,
  deploymentTarget: deploymentTargetSchema,
  legalTemplates: z.object({
    privacyTemplate: z.string(),
    cookieTemplate: z.string(),
    disclaimerTemplate: z.string(),
    contactEmailPlaceholder: z.string()
  }),
  providerRefs: z.record(z.string(), z.string().optional()).optional().default({}),
  featureFlags: z.object({
    adSlotsDefault: z.boolean()
  })
});

export const siteRegistryEntrySchema = z.object({
  siteSlug: z.string().min(1),
  ownerType: z.enum(['internal', 'client']),
  mode: z.enum(['transfer', 'managed']),
  ownerEmail: z.string().email().optional(),
  sanityProjectId: z.string().optional(),
  sanityDataset: z.string().optional(),
  sanityApiVersion: z.string().optional(),
  tokenRefs: z.object({
    read: z.string().optional(),
    write: z.string().optional()
  }).optional(),
  studioUrl: z.string().url().optional(),
  adConfig: z.object({
    provider: z.literal('adsense'),
    fallbackToPlatform: z.boolean().optional(),
    publisherId: z.string().optional(),
    slots: z.object({
      header: z.string().optional(),
      inContent: z.string().optional(),
      footer: z.string().optional()
    }).optional()
  }).optional(),
  webBaseUrl: z.string().optional(),
  domainStatus: z.enum(['pending', 'active', 'transferred']),
  automationStatus: z.enum(['inactive', 'active', 'paused']),
  billingStatus: z.enum(['n/a', 'trial', 'active', 'overdue', 'canceled']).optional(),
  updatedAt: z.string()
});

export const generationJobRequestSchema = z.object({
  siteSlug: z.string().min(1),
  stage: z.enum(['topics', 'brief', 'articles', 'images', 'qa', 'publish', 'pipeline']),
  input: z.record(z.string(), z.unknown()),
  options: z.object({
    budgetModeOverride: z.enum(['normal', 'economy', 'throttle', 'stop']).optional(),
    dryRun: z.boolean().optional(),
    workflowRunner: z.enum(['n8n', 'bullmq', 'direct']).optional()
  }).optional()
});
