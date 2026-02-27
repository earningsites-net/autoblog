import { z } from 'zod';

export const categorySeedSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  accent: z.enum(['rust', 'sage'])
});

export const siteBlueprintSchema = z.object({
  version: z.number().int().positive(),
  siteSlug: z.string().min(1),
  brandName: z.string().min(1),
  siteDescription: z.string().min(1),
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
  publishingTarget: z.object({
    kind: z.enum(['sanity', 'wordpress', 'directus'])
  }).and(z.record(z.string(), z.unknown())),
  deploymentTarget: z.object({
    kind: z.enum(['vercel', 'netlify', 'none'])
  }).and(z.record(z.string(), z.unknown())),
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
