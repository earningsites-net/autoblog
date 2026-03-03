export type PublishingTargetKind = 'sanity' | 'wordpress' | 'directus';
export type DeploymentTargetKind = 'vercel' | 'netlify' | 'none';
export type WorkflowRunnerKind = 'n8n' | 'bullmq' | 'direct';
export type BudgetMode = 'normal' | 'economy' | 'throttle' | 'stop';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type BusinessMode = 'transfer_first' | 'managed';
export type ThemeTone = 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
export type ThemeRecipe =
  | 'bold_magazine'
  | 'editorial_luxury'
  | 'warm_wellness'
  | 'playful_kids'
  | 'technical_minimal'
  | 'noir_luxury_dark'
  | 'midnight_wellness_dark'
  | 'arcade_play_dark';

export type BrandThemeConfig = {
  palette: {
    paper: string;
    ink: string;
    rust: string;
    sage: string;
    coal: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  visualStyle: string;
};

export type ThemeProfileConfig = {
  tone: ThemeTone;
  recipe: ThemeRecipe;
  layoutDensity: 'airy' | 'balanced' | 'compact';
  cardStyle: 'soft' | 'sharp' | 'mixed';
  accentIntensity: 'soft' | 'medium' | 'vivid';
  backgroundStyle: 'grain' | 'gradient' | 'pattern';
};

export type NichePolicyConfig = {
  primaryNiche: string;
  allowedSubtopics: string[];
  excludedSubtopics: string[];
  scopeNotes?: string[];
  disclaimerVariants: Array<'general' | 'safety'>;
};

export type CategorySeed = {
  slug: string;
  title: string;
  description: string;
  accent: 'rust' | 'sage';
};

export type PromptPresetVersionMap = {
  topicDiscovery: string;
  briefGeneration: string;
  articleGeneration: string;
  imageGeneration: string;
  qaScoring: string;
};

export type BudgetPolicyConfig = {
  monthlyCapUsd: number;
  publishQuota: {
    minPerDay: number;
    maxPerDay: number;
    topicCandidatesPerDay: number;
  };
  thresholds: {
    normalMaxRatio: number;
    economyMaxRatio: number;
    throttleMaxRatio: number;
  };
};

export type ProviderCredentialRef = {
  textProviderKeyRef?: string;
  imageProviderKeyRef?: string;
  cmsReadKeyRef?: string;
  cmsWriteKeyRef?: string;
  alertingKeyRef?: string;
};

export type CadenceRuleConfig = {
  label?: string;
  startAt?: string | null;
  endAt?: string | null;
  maxPublishes: number;
  perMinutes?: number;
  perDays?: number;
};

export type PrepopulateConfig = {
  targetPublishedCount: number;
  batchSize: number;
  mode: 'bulk_direct';
  maxRunMinutes: number;
  maxCostUsd: number;
};

export type PublishingCadenceConfig = {
  strategy: 'steady_scheduled';
  timezone: string;
  revalidateEnabled: boolean;
  revalidateContinueOnFail?: boolean;
  maxPublishesPerRun: number;
  cadenceRules: CadenceRuleConfig[];
};

export type DeliveryConfig = {
  handoffEnabled: boolean;
  managedEligible: boolean;
};

export type OpsDefaultsConfig = {
  publishEnabled: boolean;
  maxPublishesPerRun: number;
  cadenceRules: CadenceRuleConfig[];
};

export type PublishingTargetConfig =
  | {
      kind: 'sanity';
      projectId?: string;
      dataset: string;
      apiVersion: string;
    }
  | {
      kind: 'wordpress';
      baseUrl?: string;
      authStrategy: 'application-password' | 'jwt' | 'oauth';
    }
  | {
      kind: 'directus';
      baseUrl?: string;
      collection?: string;
    };

export type DeploymentTargetConfig = {
  kind: DeploymentTargetKind;
  projectName?: string;
  teamScope?: string;
};

export type LegalTemplateConfig = {
  privacyTemplate: string;
  cookieTemplate: string;
  disclaimerTemplate: string;
  contactEmailPlaceholder: string;
};

export type SiteBlueprint = {
  version: number;
  siteSlug: string;
  brandName: string;
  siteDescription: string;
  businessMode?: BusinessMode;
  delivery?: DeliveryConfig;
  opsDefaults?: OpsDefaultsConfig;
  locale: string;
  theme: BrandThemeConfig;
  themeProfile?: ThemeProfileConfig;
  niche: NichePolicyConfig;
  categories: CategorySeed[];
  seedTopics: string[];
  budgetPolicy: BudgetPolicyConfig;
  promptPresetVersions: PromptPresetVersionMap;
  publishingTarget: PublishingTargetConfig;
  deploymentTarget: DeploymentTargetConfig;
  legalTemplates: LegalTemplateConfig;
  providerRefs: ProviderCredentialRef;
  prepopulate?: PrepopulateConfig;
  publishing?: PublishingCadenceConfig;
  featureFlags: {
    adSlotsDefault: boolean;
  };
};

export type SiteRegistryEntry = {
  siteSlug: string;
  ownerType: 'internal' | 'client';
  mode: 'transfer' | 'managed';
  sanityProjectId?: string;
  sanityDataset?: string;
  tokenRefs?: {
    read?: string;
    write?: string;
  };
  webBaseUrl?: string;
  domainStatus: 'pending' | 'active' | 'transferred';
  automationStatus: 'inactive' | 'active' | 'paused';
  billingStatus?: 'n/a' | 'trial' | 'active' | 'overdue' | 'canceled';
  updatedAt: string;
};

export type GenerationStage = 'topics' | 'brief' | 'articles' | 'images' | 'qa' | 'publish' | 'pipeline';

export type GenerationJobRequest = {
  siteSlug: string;
  stage: GenerationStage;
  input: Record<string, unknown>;
  options?: {
    budgetModeOverride?: BudgetMode;
    dryRun?: boolean;
    workflowRunner?: WorkflowRunnerKind;
  };
};

export type GenerationJobResult = {
  jobId: string;
  siteSlug: string;
  stage: GenerationStage;
  status: JobStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
  costEstimateUsd?: number;
  budgetMode?: BudgetMode;
};

export type HealthStatus = {
  siteSlug: string;
  ok: boolean;
  publishingTarget: PublishingTargetKind;
  workflowRunner: WorkflowRunnerKind;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
};

export type HandoffExportManifest = {
  siteSlug: string;
  createdAt: string;
  blueprintPath: string;
  files: string[];
  notes: string[];
};
