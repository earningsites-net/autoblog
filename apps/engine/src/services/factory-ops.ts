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

    const blueprintPath = path.join(this.workspaceRoot, 'sites', siteSlug, 'site.blueprint.json');
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
    const args = ['new', input.siteSlug, '--blueprint', input.blueprint || 'home-diy-magazine'];
    if (input.brandName) args.push('--brand-name', input.brandName);
    if (input.locale) args.push('--locale', input.locale);
    if (input.businessMode) args.push('--business-mode', input.businessMode);
    if (input.force) args.push('--force');

    const create = await this.runAutoblog(args);
    if (!create.ok) return { step: 'new', ...create };

    const niche = await this.applyNichePreset(input.siteSlug, input.nichePreset);
    if (!niche.ok) return { ok: false, step: 'niche-preset', create, niche };

    const themeArgs = ['theme-generate', input.siteSlug];
    if (input.themeTone) themeArgs.push('--tone', input.themeTone);
    if (!input.themeTone && input.nichePreset) {
      themeArgs.push('--tone', NICHE_PRESETS[input.nichePreset].themeTone);
    }
    if (input.themeRecipe) themeArgs.push('--recipe', input.themeRecipe);
    const theme = await this.runAutoblog(themeArgs);
    if (!theme.ok) return { ok: false, step: 'theme-generate', create, niche, theme };

    const provision = await this.runAutoblog(['provision-env', input.siteSlug, '--force']);
    if (!provision.ok) return { ok: false, step: 'provision-env', create, niche, theme, provision };

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
    if (!initContent.ok) return { ok: false, step: 'init-content', create, niche, theme, provision, initContent };

    const seedCms = await this.runAutoblog(['seed-cms', input.siteSlug]);
    if (!seedCms.ok) return { ok: false, step: 'seed-cms', create, niche, theme, provision, initContent, seedCms };

    const cmsMutationsFile = `sites/${input.siteSlug}/seed-content/sanity.mutations.json`;
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
      steps: { create, niche, theme, provision, initContent, seedCms, cmsApplied }
    };
  }

  async seedCms(input: SeedCmsInput) {
    const seed = await this.runAutoblog(['seed-cms', input.siteSlug]);
    if (!seed.ok) return { ok: false, step: 'seed-cms', seed };

    const mutationFile = `sites/${input.siteSlug}/seed-content/sanity.mutations.json`;
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

    const mutationFile = `sites/${input.siteSlug}/seed-content/topic-candidates.mutations.json`;
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

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        blueprint: input.blueprint || 'home-diy-magazine',
        businessMode: input.businessMode || 'transfer_first',
        nichePreset: input.nichePreset || null,
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
    const siteDir = path.join(this.workspaceRoot, 'sites', siteSlug);
    const blueprintPath = path.join(siteDir, 'site.blueprint.json');
    const envPath = path.join(siteDir, '.env.generated');
    const cmsMutationsPath = path.join(siteDir, 'seed-content', 'sanity.mutations.json');
    const topicMutationsPath = path.join(siteDir, 'seed-content', 'topic-candidates.mutations.json');
    const handoffManifestPath = path.join(siteDir, 'handoff', 'manifest.json');
    const registryPath = path.join(this.workspaceRoot, 'sites', 'registry.json');

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
      registryEntry
    };
  }
}
