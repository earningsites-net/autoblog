#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const SITES_ROOT = path.join(WORKSPACE_ROOT, 'sites');
const TEMPLATES_ROOT = path.join(SITES_ROOT, 'templates');

function usage() {
  console.log(`
Usage:
  autoblog new <site-slug> --blueprint <template-id> [--brand-name "Brand"] [--force]
  autoblog init-content <site-slug>
  autoblog provision-env <site-slug> [--force]
  autoblog seed-cms <site-slug>
  autoblog seed-topics <site-slug> [--count 30] [--status brief_ready] [--replace] [--source suggest|synthetic]
  autoblog discover-topics <site-slug> [--count 30] [--status brief_ready] [--replace] [--source suggest|synthetic]
  autoblog deploy <site-slug>
  autoblog doctor <site-slug>
  autoblog handoff-pack <site-slug>
  autoblog list-blueprints
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const positional = [];
  const flags = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }

  return { command, positional, flags };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function toTitleCaseFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
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

function inferTemplateType(query) {
  const q = String(query || '').toLowerCase();
  if (q.includes('checklist')) return 'checklist';
  if (q.includes('ideas')) return 'list';
  if (q.includes('tips')) return 'tips';
  if (q.includes('routine')) return 'checklist';
  if (q.includes('how to')) return 'how-to';
  return 'tips';
}

function buildBriefOutline(query, templateType) {
  const title = String(query || 'home and diy topic');
  if (templateType === 'checklist') {
    return [
      `## What to prepare before you start`,
      `## Checklist for ${title}`,
      `### Quick wins first`,
      `### Keep it renter-friendly and low-cost`,
      `## Common mistakes to avoid`,
      `## Simple maintenance plan`
    ].join('\n');
  }
  if (templateType === 'list') {
    return [
      `## Start with the easiest improvements`,
      `## Best ${title} options for beginners`,
      `### Low-cost ideas`,
      `### Small-space friendly ideas`,
      `## How to maintain the setup`,
      `## Mistakes to avoid`
    ].join('\n');
  }
  if (templateType === 'how-to') {
    return [
      `## What you need before starting`,
      `## Step-by-step process`,
      `### Setup`,
      `### Main work`,
      `### Final checks`,
      `## Safety notes and mistakes to avoid`
    ].join('\n');
  }
  return [
    `## Start simple with the biggest impact`,
    `## Practical ${title} tips for beginners`,
    `### Budget-friendly options`,
    `### Small-space or renter-friendly options`,
    `## What to avoid`,
    `## Easy routine to maintain results`
  ].join('\n');
}

function buildTopicBrief(query, templateType) {
  return {
    angle: 'Practical, beginner-friendly, low-cost improvements with minimal tools and no advanced repairs.',
    audience: 'Beginners, renters, and homeowners looking for simple home and DIY improvements.',
    outlineMarkdown: buildBriefOutline(query, templateType),
    faqIdeas: [
      `What is the easiest way to start ${query}?`,
      `How can I keep costs low for ${query}?`,
      `What mistakes should I avoid with ${query}?`
    ]
  };
}

function generateTopicQueries(seedTopics, targetCount) {
  const modifiers = [
    'for beginners',
    'for small spaces',
    'for renters',
    'on a budget',
    'step by step',
    'mistakes to avoid',
    'easy wins',
    'that are easy to maintain',
    'for apartments'
  ];

  const prefixes = [
    'simple',
    'practical',
    'beginner-friendly',
    'low-cost'
  ];

  const perSeedVariants = [];
  for (const seed of seedTopics) {
    const base = String(seed || '').trim();
    if (!base) continue;
    const local = [base];

    for (const modifier of modifiers) {
      if (base.toLowerCase().includes(modifier)) continue;
      local.push(`${base} ${modifier}`);
    }

    for (const prefix of prefixes) {
      if (base.toLowerCase().startsWith(`${prefix} `)) continue;
      local.push(`${prefix} ${base}`);
    }

    if (!/checklist/i.test(base)) local.push(`${base} checklist`);
    if (!/ideas/i.test(base)) local.push(`${base} ideas`);
    if (!/tips/i.test(base)) local.push(`${base} tips`);

    perSeedVariants.push(uniqueStrings(local));
  }

  const out = [];
  const seen = new Set();
  let cursor = 0;
  while (out.length < Math.max(1, targetCount)) {
    let addedThisRound = false;
    for (const list of perSeedVariants) {
      const candidate = list[cursor];
      if (!candidate) continue;
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
      addedThisRound = true;
      if (out.length >= targetCount) break;
    }
    if (!addedThisRound) break;
    cursor += 1;
  }

  return out;
}

function tokenizeForMatching(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !['and', 'the', 'for', 'with', 'from', 'into'].includes(part));
}

function buildCategoryProfiles(categories) {
  return (Array.isArray(categories) ? categories : []).map((category, index) => {
    const slug = String(category?.slug || '').trim();
    const title = String(category?.title || '').trim();
    const description = String(category?.description || '').trim();
    const keywordSet = new Set([
      ...tokenizeForMatching(slug.replace(/-/g, ' ')),
      ...tokenizeForMatching(title),
      ...tokenizeForMatching(description)
    ]);
    return {
      index,
      slug,
      title,
      description,
      keywords: [...keywordSet]
    };
  }).filter((profile) => profile.slug);
}

function scoreCategoryForQuery(query, profile) {
  const queryTokens = tokenizeForMatching(query);
  if (!queryTokens.length) return 0;
  const keywordSet = new Set(profile.keywords);
  let score = 0;
  for (const token of queryTokens) {
    if (keywordSet.has(token)) score += 2;
  }
  if (String(query || '').toLowerCase().includes(String(profile.title || '').toLowerCase())) score += 1;
  return score;
}

function classifyQueryToCategory(query, profiles) {
  if (!profiles.length) return null;
  let best = profiles[0];
  let bestScore = -1;
  for (const profile of profiles) {
    const score = scoreCategoryForQuery(query, profile);
    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }
  return best;
}

function isSafeTopicQuery(query, excludedSubtopics) {
  const q = String(query || '').toLowerCase();
  if (!q) return false;
  if (q.length < 6 || q.length > 120) return false;

  const hardBlocked = [
    /electrical|wiring|breaker|circuit|voltage|panel/i,
    /plumbing repair|pipe repair|sewer|toilet repair|water heater/i,
    /foundation|load-bearing|structural/i,
    /medical|health claim|diagnose|treat|cure/i,
    /legal|financial|tax|insurance|investment/i
  ];
  if (hardBlocked.some((pattern) => pattern.test(q))) return false;

  const excluded = Array.isArray(excludedSubtopics) ? excludedSubtopics : [];
  if (excluded.some((item) => q.includes(String(item || '').toLowerCase()))) return false;
  return true;
}

function buildCategorySeedMap(seedTopics, categoryProfiles) {
  const map = new Map();
  for (const profile of categoryProfiles) map.set(profile.slug, []);
  for (const seed of seedTopics) {
    const category = classifyQueryToCategory(seed, categoryProfiles);
    if (!category) continue;
    const list = map.get(category.slug) || [];
    list.push(seed);
    map.set(category.slug, list);
  }
  for (const profile of categoryProfiles) {
    const list = map.get(profile.slug) || [];
    list.push(profile.title);
    list.push(`${profile.title} tips`);
    list.push(`${profile.title} ideas`);
    list.push(`${profile.title} checklist`);
    list.push(`${profile.title} for beginners`);
    map.set(profile.slug, uniqueStrings(list));
  }
  return map;
}

async function fetchGoogleSuggest(query, locale = 'en-US') {
  const language = String(locale || 'en-US').split('-')[0] || 'en';
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(language)}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'autoblog-topic-discovery/1.0'
    }
  });
  if (!response.ok) {
    throw new Error(`Suggest request failed (${response.status})`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];
  return payload[1]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function synthesizeQueriesForCategory(baseSeeds, perCategoryTarget) {
  const synthetic = generateTopicQueries(baseSeeds, Math.max(perCategoryTarget * 2, 10));
  return synthetic.slice(0, perCategoryTarget);
}

async function discoverTopicQueriesByCategory({
  seedTopics,
  categories,
  targetCount,
  locale,
  excludedSubtopics
}) {
  const profiles = buildCategoryProfiles(categories);
  if (!profiles.length) {
    throw new Error('No categories found in blueprint. Categories are required for dynamic distribution.');
  }

  const perCategoryTarget = Math.max(1, Math.ceil(targetCount / profiles.length));
  const categorySeedMap = buildCategorySeedMap(seedTopics, profiles);
  const globalSeen = new Set();
  const output = [];

  for (const profile of profiles) {
    const seeds = categorySeedMap.get(profile.slug) || [];
    const collected = [];
    let requestCount = 0;
    const maxRequestsPerCategory = 18;

    for (const seed of seeds) {
      if (collected.length >= perCategoryTarget) break;
      if (requestCount >= maxRequestsPerCategory) break;
      requestCount += 1;

      let suggestions = [];
      try {
        suggestions = await fetchGoogleSuggest(seed, locale);
      } catch {
        suggestions = [];
      }

      for (const suggestion of suggestions) {
        if (collected.length >= perCategoryTarget) break;
        if (!isSafeTopicQuery(suggestion, excludedSubtopics)) continue;
        const assigned = classifyQueryToCategory(suggestion, profiles);
        if (!assigned || assigned.slug !== profile.slug) continue;
        const key = suggestion.toLowerCase();
        if (globalSeen.has(key)) continue;
        globalSeen.add(key);
        collected.push({ query: suggestion, categorySlug: profile.slug });
      }
    }

    if (collected.length < perCategoryTarget) {
      const fallback = synthesizeQueriesForCategory(seeds, perCategoryTarget);
      for (const suggestion of fallback) {
        if (collected.length >= perCategoryTarget) break;
        if (!isSafeTopicQuery(suggestion, excludedSubtopics)) continue;
        const key = suggestion.toLowerCase();
        if (globalSeen.has(key)) continue;
        globalSeen.add(key);
        collected.push({ query: suggestion, categorySlug: profile.slug });
      }
    }

    output.push(...collected);
  }

  if (output.length < targetCount) {
    const fallbackAll = generateTopicQueries(seedTopics, targetCount * 3);
    for (const query of fallbackAll) {
      if (output.length >= targetCount) break;
      if (!isSafeTopicQuery(query, excludedSubtopics)) continue;
      const key = query.toLowerCase();
      if (globalSeen.has(key)) continue;
      globalSeen.add(key);
      const assigned = classifyQueryToCategory(query, profiles) || profiles[0];
      output.push({ query, categorySlug: assigned.slug });
    }
  }

  return output.slice(0, targetCount);
}

function buildTopicCandidateDoc(query, index, status, workflowRunId, categorySlug) {
  const normalizedQuery = String(query).trim();
  const templateType = inferTemplateType(normalizedQuery);
  const targetKeyword = normalizedQuery;
  const supportingKeywords = uniqueStrings([
    `${normalizedQuery} for beginners`,
    `${normalizedQuery} checklist`,
    `${normalizedQuery} budget tips`
  ]).slice(0, 3);

  return {
    _id: `topicCandidate-${slugify(normalizedQuery) || index + 1}`,
    _type: 'topicCandidate',
    query: normalizedQuery,
    targetKeyword,
    supportingKeywords,
    searchIntent: 'informational',
    templateType,
    status,
    categorySlug: categorySlug || undefined,
    evergreenScore: 75,
    riskScore: 10,
    brief: buildTopicBrief(normalizedQuery, templateType),
    workflowRunId
  };
}

function listBlueprintTemplates() {
  if (!exists(TEMPLATES_ROOT)) return [];
  return fs
    .readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => exists(path.join(TEMPLATES_ROOT, entry.name, 'site.blueprint.template.json')))
    .map((entry) => entry.name)
    .sort();
}

function resolveTemplatePath(templateId) {
  return path.join(TEMPLATES_ROOT, templateId, 'site.blueprint.template.json');
}

function resolveSiteDir(siteSlug) {
  return path.join(SITES_ROOT, siteSlug);
}

function resolveSiteBlueprintPath(siteSlug) {
  return path.join(resolveSiteDir(siteSlug), 'site.blueprint.json');
}

function loadSiteBlueprint(siteSlug) {
  const filePath = resolveSiteBlueprintPath(siteSlug);
  if (!exists(filePath)) {
    throw new Error(`Missing site blueprint: ${filePath}`);
  }
  return readJson(filePath);
}

function parseEnvFile(filePath) {
  if (!exists(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    env[key] = value;
  }
  return env;
}

function serializeEnv(envMap) {
  return `${Object.entries(envMap)
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .join('\n')}\n`;
}

function commandNew(siteSlug, flags) {
  if (!siteSlug) throw new Error('Missing <site-slug>');
  const templateId = String(flags.blueprint || 'home-diy-magazine');
  const templatePath = resolveTemplatePath(templateId);
  if (!exists(templatePath)) {
    throw new Error(`Unknown blueprint template '${templateId}'. Try: ${listBlueprintTemplates().join(', ')}`);
  }

  const targetDir = resolveSiteDir(siteSlug);
  const targetBlueprintPath = resolveSiteBlueprintPath(siteSlug);
  if (exists(targetBlueprintPath) && !flags.force) {
    throw new Error(`Site already exists: ${targetBlueprintPath} (use --force to overwrite)`);
  }

  const blueprint = readJson(templatePath);
  blueprint.siteSlug = siteSlug;
  blueprint.brandName = String(flags['brand-name'] || blueprint.brandName || toTitleCaseFromSlug(siteSlug));
  if (typeof flags.locale === 'string') blueprint.locale = flags.locale;

  ensureDir(targetDir);
  writeJson(targetBlueprintPath, blueprint);

  const notesPath = path.join(targetDir, 'README.md');
  if (!exists(notesPath) || flags.force) {
    fs.writeFileSync(
      notesPath,
      `# ${blueprint.brandName}\n\nGenerated from blueprint: ${templateId}\n\nFiles:\n- site.blueprint.json\n- seed-content/ (generated)\n- handoff/ (generated)\n`,
      'utf8'
    );
  }

  console.log(`Created site '${siteSlug}' from blueprint '${templateId}'`);
  console.log(`Blueprint: ${targetBlueprintPath}`);
}

function commandInitContent(siteSlug) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const seedDir = path.join(resolveSiteDir(siteSlug), 'seed-content');
  ensureDir(seedDir);

  const categories = (blueprint.categories || []).map((category) => ({
    _id: `category-${category.slug}`,
    _type: 'category',
    title: category.title,
    slug: { current: category.slug },
    description: category.description,
    accent: category.accent
  }));

  const tags = [
    { _id: 'tag-small-spaces', _type: 'tag', title: 'Small Spaces', slug: { current: 'small-spaces' } },
    { _id: 'tag-checklists', _type: 'tag', title: 'Checklists', slug: { current: 'checklists' } },
    { _id: 'tag-seasonal', _type: 'tag', title: 'Seasonal', slug: { current: 'seasonal' } },
    { _id: 'tag-beginner', _type: 'tag', title: 'Beginner', slug: { current: 'beginner' } }
  ];

  const promptPresets = Object.entries(blueprint.promptPresetVersions || {}).map(([stageKey, version]) => ({
    _id: `prompt-${String(stageKey)}-${String(version)}`,
    _type: 'promptPreset',
    name: `${stageKey} ${version}`,
    stage: normalizePromptStage(stageKey),
    version,
    modelHint: '',
    promptTemplatePath: `docs/prompts/${version}.md`,
    active: true
  }));

  writeJson(path.join(seedDir, 'categories.json'), categories);
  writeJson(path.join(seedDir, 'tags.json'), tags);
  writeJson(path.join(seedDir, 'prompt-presets.json'), promptPresets);
  writeJson(path.join(seedDir, 'topic-seeds.json'), {
    siteSlug,
    seedTopics: blueprint.seedTopics || []
  });

  console.log(`Initialized seed content for '${siteSlug}' in ${seedDir}`);
}

function normalizePromptStage(stageKey) {
  if (/topic/i.test(stageKey)) return 'topic';
  if (/brief/i.test(stageKey)) return 'brief';
  if (/article/i.test(stageKey)) return 'article';
  if (/image/i.test(stageKey)) return 'image';
  if (/qa/i.test(stageKey)) return 'qa';
  return 'article';
}

function buildPublishingSettingsFromBlueprint(blueprint) {
  const now = new Date();
  const plus24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const fallbackRules = [
    {
      label: 'Launch burst (1 per 3 minutes)',
      startAt: now.toISOString(),
      endAt: plus24h.toISOString(),
      maxPublishes: 1,
      perMinutes: 3
    },
    {
      label: 'Steady cadence (1 per day)',
      startAt: plus24h.toISOString(),
      endAt: null,
      maxPublishes: 1,
      perDays: 1
    }
  ];

  const blueprintPublishing = blueprint.publishing || {};
  const sourceRules = Array.isArray(blueprintPublishing.cadenceRules) && blueprintPublishing.cadenceRules.length > 0
    ? blueprintPublishing.cadenceRules
    : fallbackRules;

  // For the first seed of a new site, make cadence rules immediately usable by anchoring
  // the first "launch" phase to now if the provided timestamps are missing/invalid/outdated.
  let resolvedRules = sourceRules.map((rule) => ({ ...rule }));
  const firstRule = resolvedRules[0];
  if (firstRule) {
    const start = firstRule.startAt ? new Date(firstRule.startAt) : null;
    const end = firstRule.endAt ? new Date(firstRule.endAt) : null;
    const stale = !start || Number.isNaN(start.getTime()) || (end && !Number.isNaN(end.getTime()) && end.getTime() < now.getTime());
    if (stale) {
      resolvedRules = fallbackRules.map((rule) => ({ ...rule }));
    }
  }

  return {
    mode: blueprintPublishing.strategy === 'steady_scheduled' ? 'steady_scheduled' : 'bulk_direct',
    defaultTimezone: blueprintPublishing.timezone || 'Europe/Rome',
    revalidateEnabled: blueprintPublishing.revalidateEnabled !== false,
    revalidateContinueOnFail: blueprintPublishing.revalidateContinueOnFail !== false,
    maxPublishesPerRun: Number(blueprintPublishing.maxPublishesPerRun || 1),
    cadenceRules: resolvedRules.map((rule, index) => ({
      _key: `cadence-${index + 1}-${slugify(rule.label || 'rule')}`.slice(0, 96),
      label: rule.label || 'Cadence rule',
      startAt: rule.startAt || null,
      endAt: rule.endAt || null,
      maxPublishes: Number(rule.maxPublishes || 1),
      ...(rule.perMinutes ? { perMinutes: Number(rule.perMinutes) } : {}),
      ...(rule.perDays ? { perDays: Number(rule.perDays) } : {})
    }))
  };
}

function commandProvisionEnv(siteSlug, flags) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const siteDir = resolveSiteDir(siteSlug);
  const envPath = path.join(siteDir, '.env.generated');
  const existing = parseEnvFile(envPath);
  const defaults = {
    NEXT_PUBLIC_SITE_NAME: blueprint.brandName,
    NEXT_PUBLIC_DEFAULT_LOCALE: blueprint.locale || 'en-US',
    NEXT_PUBLIC_SITE_URL: `https://${siteSlug}.example.com`,
    NEXT_PUBLIC_SITE_DESCRIPTION: blueprint.siteDescription || '',
    SITE_BLUEPRINT_PATH: `./sites/${siteSlug}/site.blueprint.json`,
    CONTENT_REPOSITORY_DRIVER: 'sanity',
    CONTENT_ENGINE_URL: 'http://localhost:8787',
    CONTENT_API_BASE_URL: '',
    ENABLE_AD_SLOTS: String(Boolean(blueprint.featureFlags?.adSlotsDefault)),
    REVALIDATE_SECRET: crypto.randomUUID().replace(/-/g, ''),
    SANITY_PROJECT_ID: '',
    SANITY_DATASET: blueprint.publishingTarget?.dataset || 'production',
    SANITY_API_VERSION: blueprint.publishingTarget?.apiVersion || '2025-01-01',
    SANITY_READ_TOKEN: '',
    SANITY_WRITE_TOKEN: '',
    MONTHLY_BUDGET_USD: String(blueprint.budgetPolicy?.monthlyCapUsd || 100),
    PUBLISH_QUOTA_MIN: String(blueprint.budgetPolicy?.publishQuota?.minPerDay || 4),
    PUBLISH_QUOTA_MAX: String(blueprint.budgetPolicy?.publishQuota?.maxPerDay || 8),
    TOPIC_DISCOVERY_TARGET_PER_DAY: String(blueprint.budgetPolicy?.publishQuota?.topicCandidatesPerDay || 20),
    PREPOPULATE_TARGET_PUBLISHED: String(blueprint.prepopulate?.targetPublishedCount || 20),
    PREPOPULATE_BATCH_SIZE: String(blueprint.prepopulate?.batchSize || 3),
    PREPOPULATE_MAX_RUN_MINUTES: String(blueprint.prepopulate?.maxRunMinutes || 90),
    PREPOPULATE_MAX_COST_USD: String(blueprint.prepopulate?.maxCostUsd || 15),
    PUBLISH_SCHEDULER_TICK_MINUTES: '1',
    PUBLISH_REVALIDATE_ENABLED: String(blueprint.publishing?.revalidateEnabled !== false),
    PUBLISH_REVALIDATE_CONTINUE_ON_FAIL: String(blueprint.publishing?.revalidateContinueOnFail !== false)
  };

  const nextEnv = { ...existing };
  for (const [key, value] of Object.entries(defaults)) {
    if (flags.force || !(key in nextEnv) || nextEnv[key] === '') {
      nextEnv[key] = value;
    }
  }

  fs.writeFileSync(envPath, serializeEnv(nextEnv), 'utf8');
  console.log(`Generated/updated env file: ${envPath}`);
}

function commandSeedCms(siteSlug) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const siteDir = resolveSiteDir(siteSlug);
  const outputDir = path.join(siteDir, 'seed-content');
  ensureDir(outputDir);

  if (blueprint.publishingTarget?.kind !== 'sanity') {
    const filePath = path.join(outputDir, 'seed-cms.plan.json');
    writeJson(filePath, {
      siteSlug,
      publishingTarget: blueprint.publishingTarget?.kind || 'unknown',
      note: 'CMS seeding payload currently implemented for Sanity only. Add adapter-specific generator for this target.'
    });
    console.log(`Wrote CMS seed plan for '${siteSlug}' (non-Sanity target)`);
    return;
  }

  const mutations = [];

  mutations.push({
    createOrReplace: {
      _id: 'siteSettings',
      _type: 'siteSettings',
      siteName: blueprint.brandName,
      siteDescription: blueprint.siteDescription || '',
      defaultLocale: blueprint.locale || 'en-US',
      adSlotsEnabled: Boolean(blueprint.featureFlags?.adSlotsDefault),
      brandPrimaryColor: blueprint.theme?.palette?.rust || '#E08748',
      brandSecondaryColor: blueprint.theme?.palette?.sage || '#829975',
      publishing: buildPublishingSettingsFromBlueprint(blueprint)
    }
  });

  for (const category of blueprint.categories || []) {
    mutations.push({
      createOrReplace: {
        _id: `category-${category.slug}`,
        _type: 'category',
        title: category.title,
        slug: { current: category.slug },
        description: category.description,
        accent: category.accent,
        allowedScopeNotes: (blueprint.niche?.allowedSubtopics || []).join('\n'),
        excludedScopeNotes: (blueprint.niche?.excludedSubtopics || []).join('\n')
      }
    });
  }

  for (const [stageKey, version] of Object.entries(blueprint.promptPresetVersions || {})) {
    mutations.push({
      createOrReplace: {
        _id: `prompt-${stageKey}-${version}`,
        _type: 'promptPreset',
        name: `${stageKey} ${version}`,
        stage: normalizePromptStage(stageKey),
        version,
        promptTemplate: `See docs/prompts/${version}.md`,
        active: true
      }
    });
  }

  const payload = { mutations };
  const filePath = path.join(outputDir, 'sanity.mutations.json');
  writeJson(filePath, payload);
  console.log(`Generated Sanity seed payload: ${filePath}`);
}

async function commandSeedTopics(siteSlug, flags) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const siteDir = resolveSiteDir(siteSlug);
  const outputDir = path.join(siteDir, 'seed-content');
  ensureDir(outputDir);

  const count = Math.max(1, Number(flags.count || 30));
  const source = String(flags.source || 'suggest').toLowerCase();
  const locale = String(flags.locale || blueprint.locale || 'en-US');
  const status = ['queued', 'brief_ready', 'generated', 'skipped'].includes(String(flags.status || 'brief_ready'))
    ? String(flags.status || 'brief_ready')
    : 'brief_ready';

  const seedTopics = Array.isArray(blueprint.seedTopics) ? blueprint.seedTopics : [];
  if (!seedTopics.length) {
    throw new Error(`No seedTopics found in blueprint for '${siteSlug}'`);
  }
  const categories = Array.isArray(blueprint.categories) ? blueprint.categories : [];
  if (!categories.length) {
    throw new Error(`No categories found in blueprint for '${siteSlug}'`);
  }

  const excludedSubtopics = blueprint.niche?.excludedSubtopics || [];
  let discovered = [];
  if (source === 'suggest') {
    discovered = await discoverTopicQueriesByCategory({
      seedTopics,
      categories,
      targetCount: count,
      locale,
      excludedSubtopics
    });
  } else if (source === 'synthetic') {
    const profiles = buildCategoryProfiles(categories);
    const fallback = generateTopicQueries(seedTopics, count * 3);
    discovered = fallback.slice(0, count).map((query) => ({
      query,
      categorySlug: (classifyQueryToCategory(query, profiles) || profiles[0])?.slug
    }));
  } else {
    throw new Error(`Unknown --source value "${source}". Use "suggest" or "synthetic".`);
  }

  if (!discovered.length) {
    throw new Error(`No topic candidates discovered for '${siteSlug}'`);
  }

  const workflowRunId = `seed-topics-${new Date().toISOString()}`;
  const docs = discovered
    .map((item, index) => buildTopicCandidateDoc(item.query, index, status, workflowRunId, item.categorySlug))
    .slice(0, count);

  const mutationOp = flags.replace ? 'createOrReplace' : 'createIfNotExists';
  const mutations = {
    mutations: docs.map((doc) => ({
      [mutationOp]: doc
    }))
  };

  const previewPath = path.join(outputDir, 'topic-candidates.generated.json');
  const mutationsPath = path.join(outputDir, 'topic-candidates.mutations.json');
  writeJson(previewPath, {
    siteSlug,
    count: docs.length,
    source,
    locale,
    status,
    workflowRunId,
    topics: docs.map((doc) => ({
      _id: doc._id,
      query: doc.query,
      categorySlug: doc.categorySlug || null,
      templateType: doc.templateType,
      status: doc.status
    }))
  });
  writeJson(mutationsPath, mutations);

  const categoryDistribution = docs.reduce((acc, doc) => {
    const key = doc.categorySlug || 'unassigned';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(`Generated ${docs.length} topicCandidate documents for '${siteSlug}'`);
  console.log(`Discovery source: ${source}`);
  console.log(`Locale: ${locale}`);
  console.log(`Category distribution: ${JSON.stringify(categoryDistribution)}`);
  console.log(`Mutation strategy: ${mutationOp}`);
  console.log(`Preview: ${previewPath}`);
  console.log(`Sanity mutations: ${mutationsPath}`);
}

function commandDeploy(siteSlug) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const siteDir = resolveSiteDir(siteSlug);
  const planPath = path.join(siteDir, 'deploy-plan.md');

  const lines = [
    `# Deploy Plan for ${blueprint.brandName}`,
    '',
    '## 1. Provision provider resources',
    '- Create Vercel project (web frontend)',
    '- Create/prepare Sanity project and dataset',
    '- Prepare n8n or engine runtime environment',
    '',
    '## 2. Configure environment',
    `- Generate env: \`node scripts/autoblog.mjs provision-env ${siteSlug}\``,
    `- Review file: \`sites/${siteSlug}/.env.generated\``,
    '',
    '## 3. Seed CMS',
    `- Generate CMS seed payload: \`node scripts/autoblog.mjs seed-cms ${siteSlug}\``,
    '- Apply payload via CMS API/CLI (Sanity mutate endpoint for Sanity targets)',
    '',
    '## 4. Deploy app',
    '- Set env vars in deployment target',
    '- Deploy Next.js app (`apps/web`)',
    '- Validate `robots.txt`, `sitemap.xml`, and `/api/revalidate`',
    '',
    '## 5. Enable automation',
    '- Import n8n workflow templates or point site to engine API',
    '- Run a smoke pipeline (topic -> publish)',
    '',
    '## 6. QA / Handoff prep',
    `- Generate handoff pack: \`node scripts/autoblog.mjs handoff-pack ${siteSlug}\``,
    '- Fill legal/contact placeholders and provider credentials securely'
  ];

  fs.writeFileSync(planPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote deploy plan: ${planPath}`);
}

function commandDoctor(siteSlug) {
  const siteDir = resolveSiteDir(siteSlug);
  const blueprintPath = resolveSiteBlueprintPath(siteSlug);
  const checks = [];

  checks.push({ name: 'site_dir', ok: exists(siteDir), path: siteDir });
  checks.push({ name: 'blueprint', ok: exists(blueprintPath), path: blueprintPath });

  let blueprint = null;
  if (exists(blueprintPath)) {
    try {
      blueprint = readJson(blueprintPath);
      checks.push({ name: 'blueprint_json_parse', ok: true });
      checks.push({ name: 'blueprint_required_siteSlug', ok: typeof blueprint.siteSlug === 'string' && blueprint.siteSlug.length > 0 });
      checks.push({ name: 'blueprint_required_brandName', ok: typeof blueprint.brandName === 'string' && blueprint.brandName.length > 0 });
      checks.push({ name: 'blueprint_categories', ok: Array.isArray(blueprint.categories) && blueprint.categories.length > 0 });
      checks.push({ name: 'blueprint_seedTopics', ok: Array.isArray(blueprint.seedTopics) && blueprint.seedTopics.length > 0 });
    } catch (error) {
      checks.push({ name: 'blueprint_json_parse', ok: false, detail: String(error.message || error) });
    }
  }

  const envPath = path.join(siteDir, '.env.generated');
  checks.push({ name: 'env_generated_exists', ok: exists(envPath), path: envPath });

  const seedPayload = path.join(siteDir, 'seed-content', 'sanity.mutations.json');
  checks.push({ name: 'seed_payload_exists', ok: exists(seedPayload), path: seedPayload });

  const failed = checks.filter((check) => !check.ok);
  const result = {
    siteSlug,
    ok: failed.length === 0,
    checks
  };

  console.log(JSON.stringify(result, null, 2));
  if (failed.length) process.exitCode = 1;
}

function commandHandoffPack(siteSlug) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const siteDir = resolveSiteDir(siteSlug);
  const handoffDir = path.join(siteDir, 'handoff');
  ensureDir(handoffDir);

  const manifest = {
    siteSlug,
    createdAt: new Date().toISOString(),
    blueprintPath: `sites/${siteSlug}/site.blueprint.json`,
    brandName: blueprint.brandName,
    publishingTarget: blueprint.publishingTarget?.kind,
    files: [
      `sites/${siteSlug}/site.blueprint.json`,
      `sites/${siteSlug}/.env.generated`,
      `sites/${siteSlug}/seed-content/sanity.mutations.json`,
      'docs/handoff-buyer-checklist.md',
      'docs/credentials-transfer-template.md',
      'docs/runbook.md',
      'docs/architecture.md'
    ],
    notes: [
      'Replace placeholder contact/legal details before sale.',
      'Transfer secrets via password manager, not plaintext files.',
      'If using shared engine mode, include migration/export steps to isolated resources before handoff.'
    ]
  };

  writeJson(path.join(handoffDir, 'manifest.json'), manifest);
  fs.writeFileSync(
    path.join(handoffDir, 'README.md'),
    `# Handoff Pack (${blueprint.brandName})\n\nSee manifest.json for the list of files and transfer notes.\n`,
    'utf8'
  );

  console.log(`Generated handoff pack in ${handoffDir}`);
}

function commandListBlueprints() {
  const items = listBlueprintTemplates();
  console.log(JSON.stringify({ count: items.length, items }, null, 2));
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === 'help') {
    usage();
    return;
  }

  try {
    switch (command) {
      case 'new':
        commandNew(positional[0], flags);
        break;
      case 'init-content':
        commandInitContent(positional[0]);
        break;
      case 'provision-env':
        commandProvisionEnv(positional[0], flags);
        break;
      case 'seed-cms':
        commandSeedCms(positional[0]);
        break;
      case 'seed-topics':
        await commandSeedTopics(positional[0], flags);
        break;
      case 'discover-topics':
        await commandSeedTopics(positional[0], flags);
        break;
      case 'deploy':
        commandDeploy(positional[0]);
        break;
      case 'doctor':
        commandDoctor(positional[0]);
        break;
      case 'handoff-pack':
        commandHandoffPack(positional[0]);
        break;
      case 'list-blueprints':
        commandListBlueprints();
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message || error}`);
    process.exitCode = 1;
  }
}

main();
