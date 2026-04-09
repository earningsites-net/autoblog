import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SiteRuntimeService } from './site-runtime-service';

type CommandResult = {
  ok: boolean;
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CreateSiteInput = {
  siteSlug: string;
  blueprint?: string;
  brandName?: string;
  locale?: string;
  businessMode?: 'transfer_first' | 'managed';
  nichePreset?: NichePresetId;
  nichePrompt?: string;
  primaryNiche?: string;
  categoryLabels?: string[];
  seedTopicLabels?: string[];
  themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
  themeRecipe?:
    | 'bold_magazine'
    | 'editorial_luxury'
    | 'warm_wellness'
    | 'playful_kids'
    | 'technical_minimal'
    | 'noir_luxury_dark'
    | 'midnight_wellness_dark'
    | 'arcade_play_dark';
  applyCmsMutations?: boolean;
  sanityProjectId?: string;
  sanityDataset?: string;
  sanityApiVersion?: string;
  sanityReadToken?: string;
  sanityWriteToken?: string;
  studioUrl?: string;
  ownerEmail?: string;
  force?: boolean;
};

type SeedCmsInput = {
  siteSlug: string;
  apply?: boolean;
};

type DiscoverTopicsInput = {
  siteSlug: string;
  count?: number;
  status?: 'queued' | 'brief_ready' | 'generated' | 'skipped';
  source?: 'suggest' | 'synthetic';
  replace?: boolean;
  apply?: boolean;
};

type PrepopulateInput = {
  siteSlug: string;
  targetPublishedCount?: number;
  batchSize?: number;
};

type HandoffInput = {
  siteSlug: string;
};

type LaunchSiteInput = {
  siteSlug: string;
  blueprint?: string;
  brandName?: string;
  locale?: string;
  businessMode?: 'transfer_first' | 'managed';
  nichePreset?: NichePresetId;
  nichePrompt?: string;
  primaryNiche?: string;
  categoryLabels?: string[];
  seedTopicLabels?: string[];
  themeTone?: 'auto' | 'editorial' | 'luxury' | 'wellness' | 'playful' | 'technical';
  themeRecipe?:
    | 'bold_magazine'
    | 'editorial_luxury'
    | 'warm_wellness'
    | 'playful_kids'
    | 'technical_minimal'
    | 'noir_luxury_dark'
    | 'midnight_wellness_dark'
    | 'arcade_play_dark';
  topicCount?: number;
  topicStatus?: 'queued' | 'brief_ready' | 'generated' | 'skipped';
  topicSource?: 'suggest' | 'synthetic';
  replaceTopics?: boolean;
  applySanity?: boolean;
  runPrepopulate?: boolean;
  prepopulateTargetPublishedCount?: number;
  prepopulateBatchSize?: number;
  sanityProjectId?: string;
  sanityDataset?: string;
  sanityApiVersion?: string;
  sanityReadToken?: string;
  sanityWriteToken?: string;
  studioUrl?: string;
  ownerEmail?: string;
  force?: boolean;
};

type NichePresetId = 'home_diy' | 'luxury_living' | 'couple_wellness' | 'kids_play';

type NichePreset = {
  id: NichePresetId;
  label: string;
  primaryNiche: string;
  siteDescription: string;
  themeTone: 'editorial' | 'luxury' | 'wellness' | 'playful';
  categories: Array<{
    slug: string;
    title: string;
    description: string;
    accent: 'rust' | 'sage';
  }>;
  seedTopics: string[];
  allowedSubtopics: string[];
  excludedSubtopics: string[];
};

const DEFAULT_BLUEPRINT_ID = 'generic-editorial-magazine';
const DEFAULT_NICHE_EXCLUSIONS = [
  'Medical advice',
  'Legal advice',
  'Financial advice',
  'Dangerous how-to instructions',
  'Invented facts or unsupported claims'
];

function uniqueStrings(values: Array<string | undefined | null>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function slugify(input: string) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function titleCase(input: string) {
  return String(input || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function compactText(input: string, maxLength = 240) {
  return String(input || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

const NICHE_PRESETS: Record<NichePresetId, NichePreset> = {
  home_diy: {
    id: 'home_diy',
    label: 'Home & DIY',
    primaryNiche: 'Home & DIY',
    siteDescription:
      'Practical guides for home organization, beginner maintenance, decor, and seasonal prep routines.',
    themeTone: 'editorial',
    categories: [
      {
        slug: 'home-organization',
        title: 'Home Organization',
        description: 'Decluttering systems, storage ideas, and realistic routines for functional spaces.',
        accent: 'rust'
      },
      {
        slug: 'cleaning-maintenance',
        title: 'Cleaning & Maintenance',
        description: 'Simple upkeep guides, cleaning plans, and beginner maintenance checklists.',
        accent: 'sage'
      },
      {
        slug: 'garden-basics',
        title: 'Garden Basics',
        description: 'Beginner-friendly garden planning, small-space ideas, and seasonal care basics.',
        accent: 'sage'
      }
    ],
    seedTopics: [
      'entryway organization ideas',
      'weekly kitchen reset routine',
      'spring patio cleanup checklist',
      'raised bed layout tips for beginners'
    ],
    allowedSubtopics: [
      'Home organization',
      'Cleaning and maintenance basics',
      'Decor ideas',
      'Gardening basics',
      'Seasonal home prep checklists'
    ],
    excludedSubtopics: [
      'Electrical work',
      'Structural engineering',
      'Advanced plumbing repairs',
      'Health or medical claims',
      'Legal or financial advice'
    ]
  },
  luxury_living: {
    id: 'luxury_living',
    label: 'Luxury Living',
    primaryNiche: 'Luxury Living',
    siteDescription:
      'Elegant editorial content on refined interiors, premium hosting, and curated lifestyle routines.',
    themeTone: 'luxury',
    categories: [
      {
        slug: 'interior-styling',
        title: 'Interior Styling',
        description: 'Refined styling ideas, composition principles, and premium visual direction.',
        accent: 'rust'
      },
      {
        slug: 'home-ambience',
        title: 'Home Ambience',
        description: 'Mood, lighting, scent, and sensory layering for elevated spaces.',
        accent: 'sage'
      },
      {
        slug: 'hosting-etiquette',
        title: 'Hosting & Etiquette',
        description: 'Practical hosting workflows with a polished, upscale guest experience.',
        accent: 'rust'
      }
    ],
    seedTopics: [
      'luxury living room styling ideas',
      'premium dining table setting guide',
      'ambient lighting plan for elegant interiors',
      'how to host a sophisticated dinner party at home'
    ],
    allowedSubtopics: [
      'Interior styling',
      'Premium home decor',
      'Hosting and etiquette',
      'Lifestyle routines',
      'Ambience and mood design'
    ],
    excludedSubtopics: [
      'Investment advice',
      'Legal claims',
      'Medical or health treatment claims',
      'Unsafe renovation guidance'
    ]
  },
  couple_wellness: {
    id: 'couple_wellness',
    label: 'Couple Wellness',
    primaryNiche: 'Couple Wellness',
    siteDescription:
      'Supportive, practical relationship wellness content focused on communication, rituals, and emotional connection.',
    themeTone: 'wellness',
    categories: [
      {
        slug: 'communication-habits',
        title: 'Communication Habits',
        description: 'Simple conversation frameworks and routines for healthier day-to-day communication.',
        accent: 'sage'
      },
      {
        slug: 'relationship-rituals',
        title: 'Relationship Rituals',
        description: 'Weekly and monthly rituals that strengthen connection and shared meaning.',
        accent: 'rust'
      },
      {
        slug: 'shared-lifestyle',
        title: 'Shared Lifestyle',
        description: 'Home, planning, and lifestyle practices that reduce friction and increase partnership.',
        accent: 'sage'
      }
    ],
    seedTopics: [
      'weekly relationship check-in questions',
      'couple communication routine at home',
      'simple date night ideas for busy couples',
      'how to build healthy habits as a couple'
    ],
    allowedSubtopics: [
      'Communication',
      'Connection rituals',
      'Conflict prevention basics',
      'Shared routines',
      'Emotional wellbeing'
    ],
    excludedSubtopics: [
      'Therapy or diagnosis claims',
      'Medical advice',
      'Legal advice',
      'Financial advice'
    ]
  },
  kids_play: {
    id: 'kids_play',
    label: 'Kids Games & Activities',
    primaryNiche: 'Kids Games & Activities',
    siteDescription:
      'Playful and practical activity ideas for kids, parents, and educators with low-prep execution.',
    themeTone: 'playful',
    categories: [
      {
        slug: 'indoor-games',
        title: 'Indoor Games',
        description: 'Low-prep indoor games for different age ranges and energy levels.',
        accent: 'rust'
      },
      {
        slug: 'creative-activities',
        title: 'Creative Activities',
        description: 'Crafts, building prompts, and hands-on activities that encourage imagination.',
        accent: 'sage'
      },
      {
        slug: 'learning-play',
        title: 'Learning Through Play',
        description: 'Simple educational game ideas for home and classroom environments.',
        accent: 'rust'
      }
    ],
    seedTopics: [
      'easy indoor games for kids',
      'creative play ideas for rainy days',
      'learning games for children at home',
      'low prep activities for toddlers and preschoolers'
    ],
    allowedSubtopics: [
      'Indoor games',
      'Outdoor play basics',
      'Creative activities',
      'Educational play',
      'Parent-child routines'
    ],
    excludedSubtopics: [
      'Medical claims',
      'Dangerous physical stunts',
      'Legal advice',
      'Financial advice'
    ]
  }
};

export class FactoryOpsService {
  private readonly autoblogScript: string;
  private readonly sanityApplyScript: string;
  private readonly siteRuntime: SiteRuntimeService;

  constructor(private readonly workspaceRoot: string) {
    this.autoblogScript = path.join(this.workspaceRoot, 'scripts', 'autoblog.mjs');
    this.sanityApplyScript = path.join(this.workspaceRoot, 'scripts', 'sanity-apply-mutations.mjs');
    this.siteRuntime = new SiteRuntimeService(this.workspaceRoot);
  }

  listNichePresets() {
    return Object.values(NICHE_PRESETS).map((preset) => ({
      id: preset.id,
      label: preset.label,
      primaryNiche: preset.primaryNiche,
      themeTone: preset.themeTone
    }));
  }

  private extractPromptBullets(prompt?: string, limit = 8) {
    const lines = String(prompt || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const bullets = lines
      .filter((line) => /^[-*•]\s+/.test(line))
      .map((line) => line.replace(/^[-*•]\s+/, '').trim())
      .filter(Boolean);

    return uniqueStrings(bullets).slice(0, limit);
  }

  private derivePrimaryNiche(prompt?: string, explicitPrimaryNiche?: string) {
    const explicit = compactText(explicitPrimaryNiche || '', 120);
    if (explicit) return explicit;

    const rawPrompt = String(prompt || '').trim();
    if (!rawPrompt) return 'Editorial Magazine';

    const focusMatch = rawPrompt.match(/focus(?:es)? on\s+(.+?)(?:[.\n]|$)/i);
    if (focusMatch?.[1]) return titleCase(compactText(focusMatch[1], 120));

    const lines = rawPrompt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^[-*•]\s+/.test(line))
      .filter((line) => !/:$/.test(line));

    return titleCase(compactText(lines[0] || rawPrompt, 120)) || 'Editorial Magazine';
  }

  private buildSiteDescription(prompt?: string, primaryNiche?: string) {
    const rawPrompt = String(prompt || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^[-*•]\s+/.test(line))
      .join(' ');

    const compact = compactText(rawPrompt, 220);
    if (compact) return compact;
    return `Editorial coverage focused on ${String(primaryNiche || 'a clearly defined niche').toLowerCase()}.`;
  }

  private synthesizeCategoryLabels(prompt?: string, primaryNiche?: string) {
    const bulletTopics = this.extractPromptBullets(prompt, 6);
    if (bulletTopics.length >= 3) return bulletTopics.slice(0, 3);

    const base = titleCase(compactText(primaryNiche || 'Core Coverage', 80)) || 'Core Coverage';
    return uniqueStrings([
      ...bulletTopics,
      base,
      `${base} Guides`,
      `${base} Analysis`
    ]).slice(0, 3);
  }

  private buildCategorySeeds(labels: string[], primaryNiche: string) {
    return uniqueStrings(labels)
      .slice(0, 6)
      .map((label, index) => {
        const title = titleCase(compactText(label, 80));
        return {
          slug: slugify(title) || `category-${index + 1}`,
          title,
          description: `Editorial coverage of ${title.toLowerCase()} within ${primaryNiche.toLowerCase()}.`,
          accent: (index % 2 === 0 ? 'rust' : 'sage') as 'rust' | 'sage'
        };
      });
  }

  private synthesizeSeedTopics(labels: string[], primaryNiche: string) {
    const base = uniqueStrings(labels).slice(0, 4);
    if (!base.length) {
      return uniqueStrings([
        `${primaryNiche} explained`,
        `${primaryNiche} trends`,
        `${primaryNiche} practical guide`,
        `${primaryNiche} examples`
      ]).slice(0, 6);
    }

    return uniqueStrings(
      base.flatMap((label) => [
        label,
        `${label} explained`,
        `${label} trends`,
        `${label} practical guide`
      ])
    ).slice(0, 8);
  }

  private async applyCustomNicheConfig(siteSlug: string, input: Pick<CreateSiteInput, 'nichePrompt' | 'primaryNiche' | 'categoryLabels' | 'seedTopicLabels'>) {
    const prompt = compactText(input.nichePrompt || '', 4000);
    const manualCategories = uniqueStrings(input.categoryLabels || []);
    const manualSeedTopics = uniqueStrings(input.seedTopicLabels || []);
    const explicitPrimaryNiche = compactText(input.primaryNiche || '', 120);

    if (!prompt && !explicitPrimaryNiche && !manualCategories.length && !manualSeedTopics.length) {
      return { ok: true, applied: false };
    }

    const blueprintPath = this.siteRuntime.getSiteBlueprintPath(siteSlug);
    const raw = await fs.readFile(blueprintPath, 'utf8');
    const blueprint = JSON.parse(raw) as Record<string, any>;

    const primaryNiche = this.derivePrimaryNiche(prompt, explicitPrimaryNiche);
    const categoryLabels = manualCategories.length ? manualCategories : this.synthesizeCategoryLabels(prompt, primaryNiche);
    const categories = this.buildCategorySeeds(categoryLabels, primaryNiche);
    const seedTopics = manualSeedTopics.length ? manualSeedTopics : this.synthesizeSeedTopics(categoryLabels, primaryNiche);
    const allowedSubtopics = uniqueStrings([
      ...categoryLabels,
      ...seedTopics.slice(0, 5)
    ]).slice(0, 10);
    const existingExcluded = Array.isArray(blueprint?.niche?.excludedSubtopics) ? blueprint.niche.excludedSubtopics : [];
    const excludedSubtopics = uniqueStrings([...existingExcluded, ...DEFAULT_NICHE_EXCLUSIONS]);

    blueprint.niche = blueprint.niche || {};
    blueprint.niche.primaryNiche = primaryNiche;
    blueprint.niche.allowedSubtopics = allowedSubtopics;
    blueprint.niche.excludedSubtopics = excludedSubtopics;
    blueprint.niche.scopeNotes = uniqueStrings([
      ...(Array.isArray(blueprint?.niche?.scopeNotes) ? blueprint.niche.scopeNotes : []),
      'Use the configured niche prompt as editorial context.'
    ]);
    if (prompt) blueprint.niche.editorialPrompt = prompt;
    blueprint.siteDescription = this.buildSiteDescription(prompt, primaryNiche);
    blueprint.categories = categories;
    blueprint.seedTopics = seedTopics;

    await fs.writeFile(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`, 'utf8');

    return {
      ok: true,
      applied: true,
      primaryNiche,
      categoryCount: categories.length,
      seedTopicCount: seedTopics.length
    };
  }

  private async pathExists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private runNodeScript(scriptPath: string, args: string[], envOverrides?: Record<string, string>): Promise<CommandResult> {
    return new Promise((resolve) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const child = spawn(process.execPath, [scriptPath, ...args], {
        cwd: this.workspaceRoot,
        env: {
          ...process.env,
          ...(envOverrides || {})
        }
      });

      child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)));
      child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));

      child.on('close', (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString('utf8');
        const stderr = Buffer.concat(stderrChunks).toString('utf8');
        resolve({
          ok: code === 0,
          command: scriptPath,
          args,
          exitCode: code ?? -1,
          stdout,
          stderr
        });
      });
    });
  }

  private runAutoblog(args: string[]) {
    return this.runNodeScript(this.autoblogScript, args);
  }

  private runSanityApply(filePath: string, envOverrides?: Record<string, string>) {
    return this.runNodeScript(this.sanityApplyScript, ['--file', filePath], envOverrides);
  }

  private async resolveSiteSanityEnv(input: {
    siteSlug: string;
    sanityProjectId?: string;
    sanityDataset?: string;
    sanityApiVersion?: string;
    sanityReadToken?: string;
    sanityWriteToken?: string;
  }) {
    const fromSiteEnv = await this.siteRuntime.getSiteSanityConnection(input.siteSlug);
    return {
      SANITY_PROJECT_ID: String(input.sanityProjectId || fromSiteEnv.projectId || '').trim(),
      SANITY_DATASET: String(input.sanityDataset || fromSiteEnv.dataset || 'production').trim(),
      SANITY_API_VERSION: String(input.sanityApiVersion || fromSiteEnv.apiVersion || '2025-01-01').trim(),
      SANITY_READ_TOKEN: String(input.sanityReadToken || fromSiteEnv.readToken || '').trim(),
      SANITY_WRITE_TOKEN: String(input.sanityWriteToken || fromSiteEnv.writeToken || '').trim()
    };
  }

  private async applySiteRuntimeOverrides(input: {
    siteSlug: string;
    businessMode?: 'transfer_first' | 'managed';
    sanityProjectId?: string;
    sanityDataset?: string;
    sanityApiVersion?: string;
    sanityReadToken?: string;
    sanityWriteToken?: string;
    studioUrl?: string;
    ownerEmail?: string;
  }) {
    const normalizedMode = input.businessMode === 'managed' ? 'managed' : 'transfer';
    const siteSlug = String(input.siteSlug || '').trim().toLowerCase();
    if (!siteSlug) return;

    const envUpdates: Record<string, string> = {};
    if (input.sanityProjectId) envUpdates.SANITY_PROJECT_ID = input.sanityProjectId;
    if (input.sanityDataset) envUpdates.SANITY_DATASET = input.sanityDataset;
    if (input.sanityApiVersion) envUpdates.SANITY_API_VERSION = input.sanityApiVersion;
    if (input.sanityReadToken) envUpdates.SANITY_READ_TOKEN = input.sanityReadToken;
    if (input.sanityWriteToken) envUpdates.SANITY_WRITE_TOKEN = input.sanityWriteToken;
    if (input.studioUrl) envUpdates.SANITY_STUDIO_URL = input.studioUrl;

    await this.siteRuntime.patchSiteEnv(siteSlug, envUpdates);
    await this.siteRuntime.upsertRegistrySite(siteSlug, {
      mode: normalizedMode,
      sanityProjectId: input.sanityProjectId,
      sanityDataset: input.sanityDataset,
      sanityApiVersion: input.sanityApiVersion,
      ownerEmail: input.ownerEmail,
      studioUrl: input.studioUrl,
      billingStatus: normalizedMode === 'managed' ? 'trial' : 'n/a'
    });
  }

  private async applyNichePreset(siteSlug: string, nichePreset?: NichePresetId) {
    if (!nichePreset) return { ok: true, applied: false };
    const preset = NICHE_PRESETS[nichePreset];
    if (!preset) {
      return { ok: false, applied: false, error: `Unknown nichePreset: ${nichePreset}` };
    }

    const blueprintPath = this.siteRuntime.getSiteBlueprintPath(siteSlug);
    const raw = await fs.readFile(blueprintPath, 'utf8');
    const blueprint = JSON.parse(raw) as Record<string, any>;

    blueprint.niche = blueprint.niche || {};
    blueprint.niche.primaryNiche = preset.primaryNiche;
    blueprint.niche.allowedSubtopics = preset.allowedSubtopics;
    blueprint.niche.excludedSubtopics = preset.excludedSubtopics;
    blueprint.siteDescription = preset.siteDescription;
    blueprint.categories = preset.categories;
    blueprint.seedTopics = preset.seedTopics;

    await fs.writeFile(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`, 'utf8');

    return {
      ok: true,
      applied: true,
      nichePreset,
      preset: {
        id: preset.id,
        label: preset.label,
        primaryNiche: preset.primaryNiche,
        themeTone: preset.themeTone
      }
    };
  }

  async createSite(input: CreateSiteInput) {
    const args = ['new', input.siteSlug, '--blueprint', input.blueprint || DEFAULT_BLUEPRINT_ID];
    if (input.brandName) args.push('--brand-name', input.brandName);
    if (input.locale) args.push('--locale', input.locale);
    if (input.businessMode) args.push('--business-mode', input.businessMode);
    if (input.force) args.push('--force');

    const create = await this.runAutoblog(args);
    if (!create.ok) return { step: 'new', ...create };

    const niche = await this.applyNichePreset(input.siteSlug, input.nichePreset);
    if (!niche.ok) return { ok: false, step: 'niche-preset', create, niche };

    const customNiche = await this.applyCustomNicheConfig(input.siteSlug, {
      nichePrompt: input.nichePrompt,
      primaryNiche: input.primaryNiche,
      categoryLabels: input.categoryLabels,
      seedTopicLabels: input.seedTopicLabels
    });
    if (!customNiche.ok) return { ok: false, step: 'custom-niche', create, niche, customNiche };

    const themeArgs = ['theme-generate', input.siteSlug];
    if (input.themeTone) themeArgs.push('--tone', input.themeTone);
    if (!input.themeTone && input.nichePreset) {
      themeArgs.push('--tone', NICHE_PRESETS[input.nichePreset].themeTone);
    }
    if (input.themeRecipe) themeArgs.push('--recipe', input.themeRecipe);
    const theme = await this.runAutoblog(themeArgs);
    if (!theme.ok) return { ok: false, step: 'theme-generate', create, niche, customNiche, theme };

    const provision = await this.runAutoblog(['provision-env', input.siteSlug, '--force']);
    if (!provision.ok) return { ok: false, step: 'provision-env', create, niche, customNiche, theme, provision };

    await this.applySiteRuntimeOverrides({
      siteSlug: input.siteSlug,
      businessMode: input.businessMode,
      sanityProjectId: input.sanityProjectId,
      sanityDataset: input.sanityDataset,
      sanityApiVersion: input.sanityApiVersion,
      sanityReadToken: input.sanityReadToken,
      sanityWriteToken: input.sanityWriteToken,
      studioUrl: input.studioUrl,
      ownerEmail: input.ownerEmail
    });

    const initContent = await this.runAutoblog(['init-content', input.siteSlug]);
    if (!initContent.ok) return { ok: false, step: 'init-content', create, niche, customNiche, theme, provision, initContent };

    const seedCms = await this.runAutoblog(['seed-cms', input.siteSlug]);
    if (!seedCms.ok) return { ok: false, step: 'seed-cms', create, niche, customNiche, theme, provision, initContent, seedCms };

    const cmsMutationsFile = this.siteRuntime.getSiteSeedContentPath(input.siteSlug, 'sanity.mutations.json');
    let cmsApplied: CommandResult | null = null;
    if (input.applyCmsMutations) {
      const sanityEnv = await this.resolveSiteSanityEnv(input);
      if (!sanityEnv.SANITY_PROJECT_ID || !sanityEnv.SANITY_WRITE_TOKEN) {
        return {
          ok: false,
          step: 'sanity-apply-cms',
          error: 'Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN for this site',
          create,
          niche,
          customNiche,
          theme,
          provision,
          initContent,
          seedCms
        };
      }
      cmsApplied = await this.runSanityApply(cmsMutationsFile, sanityEnv);
      if (!cmsApplied.ok) {
        return {
          ok: false,
          step: 'sanity-apply-cms',
          create,
          niche,
          customNiche,
          theme,
          provision,
          initContent,
          seedCms,
          cmsApplied
        };
      }
    }

    return {
      ok: true,
      siteSlug: input.siteSlug,
      steps: { create, niche, customNiche, theme, provision, initContent, seedCms, cmsApplied }
    };
  }

  async seedCms(input: SeedCmsInput) {
    const seed = await this.runAutoblog(['seed-cms', input.siteSlug]);
    if (!seed.ok) return { ok: false, step: 'seed-cms', seed };

    const mutationFile = this.siteRuntime.getSiteSeedContentPath(input.siteSlug, 'sanity.mutations.json');
    let applied: CommandResult | null = null;
    if (input.apply) {
      const sanityEnv = await this.resolveSiteSanityEnv({ siteSlug: input.siteSlug });
      if (!sanityEnv.SANITY_PROJECT_ID || !sanityEnv.SANITY_WRITE_TOKEN) {
        return {
          ok: false,
          step: 'sanity-apply',
          error: 'Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN for this site',
          seed
        };
      }
      applied = await this.runSanityApply(mutationFile, sanityEnv);
      if (!applied.ok) return { ok: false, step: 'sanity-apply', seed, applied };
    }

    return { ok: true, siteSlug: input.siteSlug, seed, applied };
  }

  async discoverTopics(input: DiscoverTopicsInput) {
    const args = [
      'discover-topics',
      input.siteSlug,
      '--count',
      String(Math.max(1, Number(input.count || 60))),
      '--status',
      input.status || 'brief_ready',
      '--source',
      input.source || 'suggest'
    ];
    if (input.replace !== false) args.push('--replace');

    const discover = await this.runAutoblog(args);
    if (!discover.ok) return { ok: false, step: 'discover-topics', discover };

    const mutationFile = this.siteRuntime.getSiteSeedContentPath(input.siteSlug, 'topic-candidates.mutations.json');
    let applied: CommandResult | null = null;
    if (input.apply) {
      const sanityEnv = await this.resolveSiteSanityEnv({ siteSlug: input.siteSlug });
      if (!sanityEnv.SANITY_PROJECT_ID || !sanityEnv.SANITY_WRITE_TOKEN) {
        return {
          ok: false,
          step: 'sanity-apply-topics',
          error: 'Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN for this site',
          discover
        };
      }
      applied = await this.runSanityApply(mutationFile, sanityEnv);
      if (!applied.ok) return { ok: false, step: 'sanity-apply-topics', discover, applied };
    }

    return { ok: true, siteSlug: input.siteSlug, discover, applied };
  }

  async prepopulate(input: PrepopulateInput) {
    const triggerUrl = process.env.PREPOPULATE_TRIGGER_URL || '';
    if (!triggerUrl) {
      return {
        ok: false,
        step: 'prepopulate',
        error: 'PREPOPULATE_TRIGGER_URL not configured. Configure an n8n webhook to trigger prepopulate_bulk_runner.'
      };
    }

    const internalToken = String(process.env.INTERNAL_API_TOKEN || '').trim();
    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalToken ? { 'x-internal-token': internalToken } : {})
      },
      body: JSON.stringify({
        siteSlug: input.siteSlug,
        targetPublishedCount: input.targetPublishedCount,
        batchSize: input.batchSize
      })
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        step: 'prepopulate',
        error: `Prepopulate trigger failed (${response.status})`,
        detail: text
      };
    }
    return {
      ok: true,
      siteSlug: input.siteSlug,
      triggerUrl,
      response: text
    };
  }

  async handoffPack(input: HandoffInput) {
    const handoff = await this.runAutoblog(['handoff-pack', input.siteSlug]);
    if (!handoff.ok) return { ok: false, step: 'handoff-pack', handoff };
    return { ok: true, siteSlug: input.siteSlug, handoff };
  }

  async launchSite(input: LaunchSiteInput) {
    const create = await this.createSite({
      siteSlug: input.siteSlug,
      blueprint: input.blueprint,
      brandName: input.brandName,
      locale: input.locale,
      businessMode: input.businessMode,
      nichePreset: input.nichePreset,
      nichePrompt: input.nichePrompt,
      primaryNiche: input.primaryNiche,
      categoryLabels: input.categoryLabels,
      seedTopicLabels: input.seedTopicLabels,
      themeTone: input.themeTone,
      themeRecipe: input.themeRecipe,
      applyCmsMutations: input.applySanity,
      sanityProjectId: input.sanityProjectId,
      sanityDataset: input.sanityDataset,
      sanityApiVersion: input.sanityApiVersion,
      sanityReadToken: input.sanityReadToken,
      sanityWriteToken: input.sanityWriteToken,
      studioUrl: input.studioUrl,
      ownerEmail: input.ownerEmail,
      force: input.force
    });
    if (!create.ok) return { ok: false, step: 'create-site', create };

    const discover = await this.discoverTopics({
      siteSlug: input.siteSlug,
      count: input.topicCount ?? 60,
      status: input.topicStatus ?? 'brief_ready',
      source: input.topicSource ?? 'suggest',
      replace: input.replaceTopics !== false,
      apply: input.applySanity
    });
    if (!discover.ok) return { ok: false, step: 'discover-topics', create, discover };

    let prepopulate: Awaited<ReturnType<FactoryOpsService['prepopulate']>> | null = null;
    if (input.runPrepopulate) {
      prepopulate = await this.prepopulate({
        siteSlug: input.siteSlug,
        targetPublishedCount: input.prepopulateTargetPublishedCount,
        batchSize: input.prepopulateBatchSize
      });
      if (!prepopulate.ok) return { ok: false, step: 'prepopulate', create, discover, prepopulate };
    }

    const handoff = await this.handoffPack({ siteSlug: input.siteSlug });
    if (!handoff.ok) return { ok: false, step: 'handoff-pack', create, discover, prepopulate, handoff };

    return {
      ok: true,
      siteSlug: input.siteSlug,
      input: {
        blueprint: input.blueprint || DEFAULT_BLUEPRINT_ID,
        businessMode: input.businessMode || 'transfer_first',
        nichePreset: input.nichePreset || null,
        primaryNiche: input.primaryNiche || null,
        nichePromptConfigured: Boolean(input.nichePrompt),
        categoryCount: Array.isArray(input.categoryLabels) ? input.categoryLabels.length : 0,
        seedTopicCount: Array.isArray(input.seedTopicLabels) ? input.seedTopicLabels.length : 0,
        topicCount: input.topicCount ?? 60,
        topicSource: input.topicSource ?? 'suggest',
        applySanity: Boolean(input.applySanity),
        runPrepopulate: Boolean(input.runPrepopulate)
      },
      steps: {
        create,
        discover,
        prepopulate,
        handoff
      }
    };
  }

  async siteStatus(siteSlug: string) {
    const blueprintPath = this.siteRuntime.getSiteBlueprintPath(siteSlug);
    const envPath = this.siteRuntime.getSiteEnvPath(siteSlug);
    const cmsMutationsPath = this.siteRuntime.getSiteSeedContentPath(siteSlug, 'sanity.mutations.json');
    const topicMutationsPath = this.siteRuntime.getSiteSeedContentPath(siteSlug, 'topic-candidates.mutations.json');
    const handoffManifestPath = this.siteRuntime.getSiteHandoffPath(siteSlug, 'manifest.json');
    const registryPath = this.siteRuntime.getRegistryPath();

    const [blueprintExists, envExists, cmsExists, topicExists, handoffExists, registryExists] = await Promise.all([
      this.pathExists(blueprintPath),
      this.pathExists(envPath),
      this.pathExists(cmsMutationsPath),
      this.pathExists(topicMutationsPath),
      this.pathExists(handoffManifestPath),
      this.pathExists(registryPath)
    ]);

    let registryEntry: Record<string, unknown> | null = null;
    if (registryExists) {
      try {
        const raw = await fs.readFile(registryPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.sites)) {
          registryEntry = parsed.sites.find((site: { siteSlug: string }) => site.siteSlug === siteSlug) || null;
        }
      } catch {
        registryEntry = null;
      }
    }

    let deploy: Record<string, unknown> | null = null;
    if (envExists) {
      try {
        const env = await this.siteRuntime.readSiteEnv(siteSlug);
        const normalizedSlug = String(env.SITE_SLUG || env.NEXT_PUBLIC_SITE_SLUG || siteSlug).trim() || siteSlug;
        const siteName = String(env.NEXT_PUBLIC_SITE_NAME || '').trim();
        const siteDescription = String(env.NEXT_PUBLIC_SITE_DESCRIPTION || '').trim();
        const projectId = String(env.SANITY_PROJECT_ID || '').trim();
        const dataset = String(env.SANITY_DATASET || 'production').trim();
        const apiVersion = String(env.SANITY_API_VERSION || '2025-01-01').trim();
        const readToken = String(env.SANITY_READ_TOKEN || '').trim();
        const revalidateSecret = String(env.REVALIDATE_SECRET || '').trim();
        const portalBaseUrl = String(env.NEXT_PUBLIC_PORTAL_BASE_URL || process.env.PORTAL_BASE_URL || '').trim();
        const suggestedStudioUrl =
          String(
            (registryEntry && typeof registryEntry.studioUrl === 'string' && registryEntry.studioUrl) ||
              env.SANITY_STUDIO_URL ||
              ''
          ).trim() || `https://${normalizedSlug}.sanity.studio`;

        deploy = {
          vercelEnv: {
            SITE_SLUG: normalizedSlug,
            NEXT_PUBLIC_SITE_SLUG: normalizedSlug,
            SANITY_STUDIO_SITE_SLUG: normalizedSlug,
            SITE_BLUEPRINT_PATH: `../../sites/${normalizedSlug}/site.blueprint.json`,
            CONTENT_REPOSITORY_DRIVER: String(env.CONTENT_REPOSITORY_DRIVER || 'sanity').trim() || 'sanity',
            SANITY_PROJECT_ID: projectId,
            SANITY_DATASET: dataset,
            SANITY_API_VERSION: apiVersion,
            SANITY_READ_TOKEN: readToken,
            NEXT_PUBLIC_SITE_NAME: siteName,
            NEXT_PUBLIC_SITE_DESCRIPTION: siteDescription,
            NEXT_PUBLIC_PORTAL_BASE_URL: portalBaseUrl,
            REVALIDATE_SECRET: revalidateSecret,
            NEXT_PUBLIC_SITE_URL: 'https://<set-after-first-vercel-deploy>'
          },
          studioDeploy: {
            projectId,
            dataset,
            apiVersion,
            siteSlug: normalizedSlug,
            hostname: normalizedSlug,
            suggestedUrl: suggestedStudioUrl
          }
        };
      } catch {
        deploy = null;
      }
    }

    return {
      siteSlug,
      exists: blueprintExists,
      files: {
        blueprint: blueprintExists,
        envGenerated: envExists,
        cmsMutations: cmsExists,
        topicMutations: topicExists,
        handoffManifest: handoffExists,
        registry: registryExists
      },
      registryEntry,
      deploy
    };
  }
}
