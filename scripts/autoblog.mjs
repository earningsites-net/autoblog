#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const SITES_ROOT = path.join(WORKSPACE_ROOT, 'sites');
const TEMPLATES_ROOT = path.join(SITES_ROOT, 'templates');
const SITE_REGISTRY_PATH = path.join(SITES_ROOT, 'registry.json');

function usage() {
  console.log(`
Usage:
  autoblog new <site-slug> --blueprint <template-id> [--brand-name "Brand"] [--force]
  autoblog theme-generate <site-slug> [--tone auto|editorial|luxury|wellness|playful|technical] [--recipe bold_magazine|editorial_luxury|warm_wellness|playful_kids|technical_minimal|noir_luxury_dark|midnight_wellness_dark|arcade_play_dark]
  autoblog init-content <site-slug>
  autoblog provision-env <site-slug> [--force]
  autoblog seed-cms <site-slug>
  autoblog seed-topics <site-slug> [--count 30] [--status brief_ready] [--replace] [--source suggest|synthetic]
  autoblog discover-topics <site-slug> [--count 30] [--status brief_ready] [--replace] [--source suggest|synthetic]
  autoblog launch-site <site-slug> [--blueprint home-diy-magazine] [--brand-name "Brand"] [--topic-count 60] [--source suggest|synthetic] [--theme-tone auto|editorial|luxury|wellness|playful|technical] [--theme-recipe <recipe>] [--apply-sanity]
  autoblog release-site <site-slug> [--from-sanity]
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

function sanitizeSiteSlug(siteSlug) {
  return slugify(siteSlug || 'default') || 'default';
}

function scopedDocId(docType, siteSlug, localId) {
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
  const safeLocalId = slugify(localId || docType) || docType;
  return `${docType}-${safeSiteSlug}-${safeLocalId}`;
}

const THEME_RECIPES = {
  bold_magazine: {
    tone: 'editorial',
    visualStyle: 'bold editorial magazine with warm contrast',
    typography: {
      headingFont: 'Space Grotesk',
      bodyFont: 'Source Serif 4'
    },
    palette: {
      paper: '#F4EEE3',
      ink: '#201A15',
      rust: '#CE6A32',
      sage: '#5F8E79',
      coal: '#2C2520'
    },
    profile: {
      layoutDensity: 'balanced',
      cardStyle: 'mixed',
      accentIntensity: 'medium',
      backgroundStyle: 'gradient'
    }
  },
  editorial_luxury: {
    tone: 'luxury',
    visualStyle: 'refined luxury editorial with high contrast and restrained accents',
    typography: {
      headingFont: 'Playfair Display',
      bodyFont: 'Cormorant Garamond'
    },
    palette: {
      paper: '#FBF6EE',
      ink: '#14100E',
      rust: '#C08B46',
      sage: '#4E7867',
      coal: '#181313'
    },
    profile: {
      layoutDensity: 'airy',
      cardStyle: 'sharp',
      accentIntensity: 'soft',
      backgroundStyle: 'grain'
    }
  },
  warm_wellness: {
    tone: 'wellness',
    visualStyle: 'calm wellness editorial with warm neutrals and soft gradients',
    typography: {
      headingFont: 'Sora',
      bodyFont: 'Merriweather'
    },
    palette: {
      paper: '#F7FBF5',
      ink: '#23312D',
      rust: '#D98D74',
      sage: '#6CA88A',
      coal: '#22322B'
    },
    profile: {
      layoutDensity: 'airy',
      cardStyle: 'soft',
      accentIntensity: 'medium',
      backgroundStyle: 'gradient'
    }
  },
  playful_kids: {
    tone: 'playful',
    visualStyle: 'playful editorial with bright accents and rounded cards',
    typography: {
      headingFont: 'Baloo 2',
      bodyFont: 'Nunito'
    },
    palette: {
      paper: '#FFF7D8',
      ink: '#2F2A45',
      rust: '#FF7A45',
      sage: '#2DB79A',
      coal: '#2C2F4A'
    },
    profile: {
      layoutDensity: 'balanced',
      cardStyle: 'soft',
      accentIntensity: 'vivid',
      backgroundStyle: 'pattern'
    }
  },
  technical_minimal: {
    tone: 'technical',
    visualStyle: 'minimal technical publication with clean geometry and subtle accents',
    typography: {
      headingFont: 'Manrope',
      bodyFont: 'IBM Plex Sans'
    },
    palette: {
      paper: '#F5F7F8',
      ink: '#172126',
      rust: '#2576B8',
      sage: '#42A58A',
      coal: '#131C21'
    },
    profile: {
      layoutDensity: 'compact',
      cardStyle: 'sharp',
      accentIntensity: 'soft',
      backgroundStyle: 'grain'
    }
  },
  noir_luxury_dark: {
    tone: 'luxury',
    visualStyle: 'dark luxury editorial with cinematic contrast and elegant metallic accents',
    typography: {
      headingFont: 'Playfair Display',
      bodyFont: 'Cormorant Garamond'
    },
    palette: {
      paper: '#EFE6D8',
      ink: '#F4EDE3',
      rust: '#C49753',
      sage: '#5E8A78',
      coal: '#121112'
    },
    profile: {
      layoutDensity: 'airy',
      cardStyle: 'sharp',
      accentIntensity: 'soft',
      backgroundStyle: 'grain'
    }
  },
  midnight_wellness_dark: {
    tone: 'wellness',
    visualStyle: 'dark wellness editorial with calm gradients and low-contrast depth',
    typography: {
      headingFont: 'Sora',
      bodyFont: 'Merriweather'
    },
    palette: {
      paper: '#E8F0EA',
      ink: '#E4EFE9',
      rust: '#C9836A',
      sage: '#6BA688',
      coal: '#121815'
    },
    profile: {
      layoutDensity: 'airy',
      cardStyle: 'soft',
      accentIntensity: 'medium',
      backgroundStyle: 'gradient'
    }
  },
  arcade_play_dark: {
    tone: 'playful',
    visualStyle: 'dark playful editorial with neon accents and bold rounded geometry',
    typography: {
      headingFont: 'Baloo 2',
      bodyFont: 'Nunito'
    },
    palette: {
      paper: '#EFEAFA',
      ink: '#F2ECFF',
      rust: '#FF7E4F',
      sage: '#3DD2B0',
      coal: '#15182B'
    },
    profile: {
      layoutDensity: 'balanced',
      cardStyle: 'soft',
      accentIntensity: 'vivid',
      backgroundStyle: 'pattern'
    }
  }
};

const DEFAULT_THEME_RECIPE = 'bold_magazine';
const VALID_THEME_RECIPES = Object.keys(THEME_RECIPES);
const VALID_THEME_TONES = ['editorial', 'luxury', 'wellness', 'playful', 'technical'];

const THEME_TONE_KEYWORDS = {
  luxury: ['luxury', 'premium', 'high-end', 'elite', 'upscale', 'elegant', 'designer', 'interior styling', 'fine living'],
  wellness: ['wellness', 'self-care', 'self care', 'relationship', 'couple', 'intimacy', 'mindful', 'calm', 'balance', 'emotional'],
  playful: ['kids', 'children', 'child', 'family fun', 'toys', 'games', 'classroom', 'learning', 'playroom', 'parents'],
  technical: ['technical', 'workflow', 'automation', 'software', 'systems', 'engineering', 'analysis', 'optimization', 'data', 'productivity']
};

const TONE_TO_RECIPE = {
  editorial: 'bold_magazine',
  luxury: 'editorial_luxury',
  wellness: 'warm_wellness',
  playful: 'playful_kids',
  technical: 'technical_minimal'
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(input) {
  const str = String(input || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function channelFromSeed(seed, channel, maxAbs) {
  if (maxAbs <= 0) return 0;
  const base = hashString(`${seed}:${channel}`);
  const span = maxAbs * 2 + 1;
  return (base % span) - maxAbs;
}

function hexToRgb(hexColor) {
  const normalized = String(hexColor || '').replace('#', '').trim();
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return null;
  const intValue = Number.parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  };
}

function rgbToHex({ r, g, b }) {
  const value = ((clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255)).toString(16).padStart(6, '0');
  return `#${value}`;
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToRgb({ h, s, l }) {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (hn < 60) {
    rn = c; gn = x; bn = 0;
  } else if (hn < 120) {
    rn = x; gn = c; bn = 0;
  } else if (hn < 180) {
    rn = 0; gn = c; bn = x;
  } else if (hn < 240) {
    rn = 0; gn = x; bn = c;
  } else if (hn < 300) {
    rn = x; gn = 0; bn = c;
  } else {
    rn = c; gn = 0; bn = x;
  }

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255)
  };
}

function shiftHexColor(hexColor, seed, channelRanges) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;
  const hsl = rgbToHsl(rgb);
  const hueShift = channelFromSeed(seed, 'h', channelRanges.h || 0);
  const satShift = channelFromSeed(seed, 's', channelRanges.s || 0);
  const lightShift = channelFromSeed(seed, 'l', channelRanges.l || 0);

  return rgbToHex(
    hslToRgb({
      h: hsl.h + hueShift,
      s: hsl.s + satShift,
      l: hsl.l + lightShift
    })
  );
}

function inferThemeTone(blueprint) {
  const text = [
    blueprint.brandName,
    blueprint.siteDescription,
    blueprint.niche?.primaryNiche,
    ...(Array.isArray(blueprint.niche?.allowedSubtopics) ? blueprint.niche.allowedSubtopics : []),
    ...(Array.isArray(blueprint.categories) ? blueprint.categories.flatMap((category) => [category.title, category.description]) : []),
    ...(Array.isArray(blueprint.seedTopics) ? blueprint.seedTopics : [])
  ].join(' ').toLowerCase();

  const scores = {
    editorial: 1,
    luxury: 0,
    wellness: 0,
    playful: 0,
    technical: 0
  };

  if (/(home|diy|garden|decor|household|lifestyle)/i.test(text)) {
    scores.editorial += 4;
  }
  if (/(kids|children|family|parent)/i.test(text)) {
    scores.playful += 2;
  }
  if (/(relationship|wellness|self-care|self care|mindful)/i.test(text)) {
    scores.wellness += 2;
  }
  if (/(luxury|premium|designer|upscale)/i.test(text)) {
    scores.luxury += 2;
  }

  for (const tone of Object.keys(THEME_TONE_KEYWORDS)) {
    const keywords = THEME_TONE_KEYWORDS[tone];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        scores[tone] += 1;
      }
    }
  }

  if (scores.technical > 0 && scores.editorial > scores.technical) {
    scores.technical = Math.max(0, scores.technical - 1);
  }

  let bestTone = 'editorial';
  let bestScore = scores.editorial;
  for (const tone of VALID_THEME_TONES) {
    const score = scores[tone] || 0;
    if (score > bestScore) {
      bestTone = tone;
      bestScore = score;
    }
  }
  return bestTone;
}

function buildThemeFromBlueprint(blueprint, options = {}) {
  const requestedTone = String(options.tone || 'auto').toLowerCase();
  const requestedRecipe = String(options.recipe || '').toLowerCase();

  const inferredTone = inferThemeTone(blueprint);
  const tone = requestedTone === 'auto'
    ? inferredTone
    : (VALID_THEME_TONES.includes(requestedTone) ? requestedTone : inferredTone);

  const recipe = VALID_THEME_RECIPES.includes(requestedRecipe) ? requestedRecipe : (TONE_TO_RECIPE[tone] || DEFAULT_THEME_RECIPE);
  const preset = THEME_RECIPES[recipe] || THEME_RECIPES[DEFAULT_THEME_RECIPE];

  const seed = `${blueprint.siteSlug}:${blueprint.brandName}:${recipe}`;
  const palette = {
    paper: shiftHexColor(preset.palette.paper, `${seed}:paper`, { h: 4, s: 4, l: 3 }),
    ink: shiftHexColor(preset.palette.ink, `${seed}:ink`, { h: 5, s: 3, l: 3 }),
    rust: shiftHexColor(preset.palette.rust, `${seed}:rust`, { h: 12, s: 10, l: 7 }),
    sage: shiftHexColor(preset.palette.sage, `${seed}:sage`, { h: 12, s: 10, l: 7 }),
    coal: shiftHexColor(preset.palette.coal, `${seed}:coal`, { h: 6, s: 4, l: 4 })
  };

  return {
    theme: {
      palette,
      typography: {
        headingFont: preset.typography.headingFont,
        bodyFont: preset.typography.bodyFont
      },
      visualStyle: preset.visualStyle
    },
    themeProfile: {
      tone: preset.tone,
      recipe,
      ...preset.profile
    }
  };
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

function buildTopicCandidateDoc(siteSlug, query, index, status, workflowRunId, categorySlug) {
  const normalizedQuery = String(query).trim();
  const templateType = inferTemplateType(normalizedQuery);
  const targetKeyword = normalizedQuery;
  const supportingKeywords = uniqueStrings([
    `${normalizedQuery} for beginners`,
    `${normalizedQuery} checklist`,
    `${normalizedQuery} budget tips`
  ]).slice(0, 3);

  return {
    _id: scopedDocId('topicCandidate', siteSlug, slugify(normalizedQuery) || String(index + 1)),
    _type: 'topicCandidate',
    siteSlug: sanitizeSiteSlug(siteSlug),
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

function ensureBusinessDefaults(blueprint) {
  const next = { ...blueprint };
  if (!next.businessMode) next.businessMode = 'transfer_first';
  if (!next.delivery) {
    next.delivery = {
      handoffEnabled: true,
      managedEligible: true
    };
  }
  if (!next.opsDefaults) {
    next.opsDefaults = {
      publishEnabled: true,
      maxPublishesPerRun: Number(next.publishing?.maxPublishesPerRun || 1),
      cadenceRules: Array.isArray(next.publishing?.cadenceRules) ? next.publishing.cadenceRules : []
    };
  }
  if (!next.themeProfile) {
    const generated = buildThemeFromBlueprint(next, { tone: 'auto' });
    next.theme = generated.theme;
    next.themeProfile = generated.themeProfile;
  }
  return next;
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

function loadWorkspaceEnv() {
  return {
    ...parseEnvFile(path.join(WORKSPACE_ROOT, 'infra', 'n8n', '.env')),
    ...parseEnvFile(path.join(WORKSPACE_ROOT, '.env')),
    ...process.env
  };
}

function loadSiteRegistry() {
  if (!exists(SITE_REGISTRY_PATH)) {
    return { version: 1, updatedAt: new Date().toISOString(), sites: [] };
  }
  try {
    const parsed = readJson(SITE_REGISTRY_PATH);
    if (!Array.isArray(parsed?.sites)) {
      return { version: 1, updatedAt: new Date().toISOString(), sites: [] };
    }
    return parsed;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), sites: [] };
  }
}

function saveSiteRegistry(registry) {
  writeJson(SITE_REGISTRY_PATH, registry);
}

function upsertSiteRegistryEntry(siteSlug, blueprint, envOverrides = {}) {
  const registry = loadSiteRegistry();
  const index = registry.sites.findIndex((site) => site.siteSlug === siteSlug);
  const mode = blueprint.businessMode === 'managed' ? 'managed' : 'transfer';
  const entry = {
    siteSlug,
    ownerType: envOverrides.ownerType || 'internal',
    mode,
    sanityProjectId: envOverrides.sanityProjectId || '',
    sanityDataset: envOverrides.sanityDataset || blueprint.publishingTarget?.dataset || 'production',
    tokenRefs: {
      read: blueprint.providerRefs?.cmsReadKeyRef || 'SANITY_READ_TOKEN',
      write: blueprint.providerRefs?.cmsWriteKeyRef || 'SANITY_WRITE_TOKEN'
    },
    webBaseUrl: envOverrides.webBaseUrl || '',
    domainStatus: envOverrides.domainStatus || 'pending',
    automationStatus: envOverrides.automationStatus || 'inactive',
    billingStatus: mode === 'managed' ? (envOverrides.billingStatus || 'trial') : 'n/a',
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) {
    registry.sites[index] = { ...registry.sites[index], ...entry };
  } else {
    registry.sites.push(entry);
  }
  registry.updatedAt = new Date().toISOString();
  saveSiteRegistry(registry);
  return entry;
}

async function applySanityMutationsFile(mutationsPath) {
  const env = loadWorkspaceEnv();
  const projectId = env.SANITY_PROJECT_ID;
  const dataset = env.SANITY_DATASET || 'production';
  const apiVersion = env.SANITY_API_VERSION || '2025-01-01';
  const writeToken = env.SANITY_WRITE_TOKEN;
  if (!projectId || !writeToken) {
    throw new Error('Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN to apply mutations.');
  }

  const absolutePath = path.resolve(WORKSPACE_ROOT, mutationsPath);
  if (!exists(absolutePath)) {
    throw new Error(`Mutations file not found: ${absolutePath}`);
  }
  const payload = readJson(absolutePath);
  if (!Array.isArray(payload?.mutations) || payload.mutations.length === 0) {
    throw new Error(`Mutations payload invalid/empty: ${absolutePath}`);
  }

  const response = await fetch(`https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${writeToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sanity mutate failed (${response.status}) for ${mutationsPath}: ${text}`);
  }
  const result = await response.json();
  return {
    file: mutationsPath,
    mutationCount: payload.mutations.length,
    transactionId: result?.transactionId || 'n/a'
  };
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

  const blueprint = ensureBusinessDefaults(readJson(templatePath));
  blueprint.siteSlug = siteSlug;
  blueprint.brandName = String(flags['brand-name'] || blueprint.brandName || toTitleCaseFromSlug(siteSlug));
  if (typeof flags.locale === 'string') blueprint.locale = flags.locale;
  if (typeof flags['business-mode'] === 'string' && ['transfer_first', 'managed'].includes(flags['business-mode'])) {
    blueprint.businessMode = flags['business-mode'];
  }
  if (flags.managed === true) blueprint.businessMode = 'managed';
  if (flags.transfer === true) blueprint.businessMode = 'transfer_first';
  if (!blueprint.delivery) {
    blueprint.delivery = { handoffEnabled: true, managedEligible: true };
  }
  if (!blueprint.opsDefaults) {
    blueprint.opsDefaults = {
      publishEnabled: true,
      maxPublishesPerRun: Number(blueprint.publishing?.maxPublishesPerRun || 1),
      cadenceRules: Array.isArray(blueprint.publishing?.cadenceRules) ? blueprint.publishing.cadenceRules : []
    };
  }

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

function commandThemeGenerate(siteSlug, flags = {}) {
  if (!siteSlug) throw new Error('Missing <site-slug>');
  const blueprintPath = resolveSiteBlueprintPath(siteSlug);
  const blueprint = ensureBusinessDefaults(loadSiteBlueprint(siteSlug));

  if (flags['preserve-existing'] && blueprint.themeProfile?.recipe) {
    console.log(JSON.stringify({
      siteSlug,
      preserved: true,
      reason: 'themeProfile already present and --preserve-existing enabled',
      recipe: blueprint.themeProfile.recipe,
      tone: blueprint.themeProfile.tone
    }, null, 2));
    return;
  }

  const generated = buildThemeFromBlueprint(blueprint, {
    tone: flags.tone || 'auto',
    recipe: flags.recipe
  });

  blueprint.theme = generated.theme;
  blueprint.themeProfile = generated.themeProfile;
  writeJson(blueprintPath, blueprint);

  console.log(JSON.stringify({
    siteSlug,
    updated: true,
    blueprintPath,
    recipe: blueprint.themeProfile.recipe,
    tone: blueprint.themeProfile.tone,
    layoutDensity: blueprint.themeProfile.layoutDensity,
    cardStyle: blueprint.themeProfile.cardStyle,
    typography: blueprint.theme.typography,
    palette: blueprint.theme.palette
  }, null, 2));
}

function commandInitContent(siteSlug) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
  const seedDir = path.join(resolveSiteDir(siteSlug), 'seed-content');
  ensureDir(seedDir);

  const categories = (blueprint.categories || []).map((category) => ({
    _id: scopedDocId('category', safeSiteSlug, category.slug),
    _type: 'category',
    siteSlug: safeSiteSlug,
    title: category.title,
    slug: { current: category.slug },
    description: category.description,
    accent: category.accent
  }));

  const tags = [
    { _id: scopedDocId('tag', safeSiteSlug, 'small-spaces'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Small Spaces', slug: { current: 'small-spaces' } },
    { _id: scopedDocId('tag', safeSiteSlug, 'checklists'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Checklists', slug: { current: 'checklists' } },
    { _id: scopedDocId('tag', safeSiteSlug, 'seasonal'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Seasonal', slug: { current: 'seasonal' } },
    { _id: scopedDocId('tag', safeSiteSlug, 'beginner'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Beginner', slug: { current: 'beginner' } }
  ];

  const promptPresets = Object.entries(blueprint.promptPresetVersions || {}).map(([stageKey, version]) => ({
    _id: scopedDocId('prompt', safeSiteSlug, `${String(stageKey)}-${String(version)}`),
    _type: 'promptPreset',
    siteSlug: safeSiteSlug,
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
  const opsDefaults = blueprint.opsDefaults || {};
  const sourceRules = Array.isArray(blueprintPublishing.cadenceRules) && blueprintPublishing.cadenceRules.length > 0
    ? blueprintPublishing.cadenceRules
    : (Array.isArray(opsDefaults.cadenceRules) && opsDefaults.cadenceRules.length > 0 ? opsDefaults.cadenceRules : fallbackRules);

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
    mode: (opsDefaults.publishEnabled === false) ? 'bulk_direct' : (blueprintPublishing.strategy === 'steady_scheduled' ? 'steady_scheduled' : 'bulk_direct'),
    defaultTimezone: blueprintPublishing.timezone || 'Europe/Rome',
    revalidateEnabled: blueprintPublishing.revalidateEnabled !== false,
    revalidateContinueOnFail: blueprintPublishing.revalidateContinueOnFail !== false,
    maxPublishesPerRun: Number(opsDefaults.maxPublishesPerRun || blueprintPublishing.maxPublishesPerRun || 1),
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
    SITE_SLUG: siteSlug,
    SANITY_STUDIO_SITE_SLUG: siteSlug,
    NEXT_PUBLIC_SITE_SLUG: siteSlug,
    NEXT_PUBLIC_SITE_NAME: blueprint.brandName,
    NEXT_PUBLIC_DEFAULT_LOCALE: blueprint.locale || 'en-US',
    NEXT_PUBLIC_SITE_URL: `https://${siteSlug}.example.com`,
    NEXT_PUBLIC_SITE_DESCRIPTION: blueprint.siteDescription || '',
    NEXT_PUBLIC_PORTAL_BASE_URL: process.env.PORTAL_BASE_URL || 'http://localhost:8787',
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
    PLATFORM_ADSENSE_PUBLISHER_ID: process.env.PLATFORM_ADSENSE_PUBLISHER_ID || '',
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
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
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
      _id: scopedDocId('siteSettings', safeSiteSlug, 'root'),
      _type: 'siteSettings',
      siteSlug: safeSiteSlug,
      siteName: blueprint.brandName,
      siteDescription: blueprint.siteDescription || '',
      defaultLocale: blueprint.locale || 'en-US',
      adSlotsEnabled: Boolean(blueprint.featureFlags?.adSlotsDefault),
      adsMode: 'auto',
      adsPreviewEnabled: true,
      adsensePublisherId: '',
      adsenseSlotHeader: '',
      adsenseSlotInContent: '',
      adsenseSlotFooter: '',
      fallbackToPlatform: true,
      studioUrl: process.env.SANITY_STUDIO_URL || '',
      brandPrimaryColor: blueprint.theme?.palette?.rust || '#E08748',
      brandSecondaryColor: blueprint.theme?.palette?.sage || '#829975',
      publishing: {
        ...buildPublishingSettingsFromBlueprint(blueprint),
        planMonthlyQuota: 3,
        publishedThisMonth: 0,
        quotaPeriodStart: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
        quotaPeriodEnd: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString()
      },
      entitlement: {
        plan: 'base',
        monthlyQuota: 3,
        publishedThisMonth: 0,
        periodStart: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
        periodEnd: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(),
        status: 'active',
        billingStatus: blueprint.businessMode === 'managed' ? 'trial' : 'n/a'
      }
    }
  });

  for (const category of blueprint.categories || []) {
    mutations.push({
      createOrReplace: {
        _id: scopedDocId('category', safeSiteSlug, category.slug),
        _type: 'category',
        siteSlug: safeSiteSlug,
        title: category.title,
        slug: { current: category.slug },
        description: category.description,
        accent: category.accent,
        allowedScopeNotes: (blueprint.niche?.allowedSubtopics || []).join('\n'),
        excludedScopeNotes: (blueprint.niche?.excludedSubtopics || []).join('\n')
      }
    });
  }

  const defaultTags = [
    { slug: 'small-spaces', title: 'Small Spaces' },
    { slug: 'checklists', title: 'Checklists' },
    { slug: 'seasonal', title: 'Seasonal' },
    { slug: 'beginner', title: 'Beginner' }
  ];

  for (const tag of defaultTags) {
    mutations.push({
      createOrReplace: {
        _id: scopedDocId('tag', safeSiteSlug, tag.slug),
        _type: 'tag',
        siteSlug: safeSiteSlug,
        title: tag.title,
        slug: { current: tag.slug }
      }
    });
  }

  for (const [stageKey, version] of Object.entries(blueprint.promptPresetVersions || {})) {
    mutations.push({
      createOrReplace: {
        _id: scopedDocId('prompt', safeSiteSlug, `${stageKey}-${version}`),
        _type: 'promptPreset',
        siteSlug: safeSiteSlug,
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
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
  const docs = discovered
    .map((item, index) => buildTopicCandidateDoc(safeSiteSlug, item.query, index, status, workflowRunId, item.categorySlug))
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

async function commandLaunchSite(siteSlug, flags) {
  if (!siteSlug) throw new Error('Missing <site-slug>');

  const blueprint = String(flags.blueprint || 'home-diy-magazine');
  const topicCount = Math.max(1, Number(flags['topic-count'] || 60));
  const source = String(flags.source || 'suggest');
  const applySanity = Boolean(flags['apply-sanity']);
  const replaceTopics = flags.replace !== false;

  commandNew(siteSlug, {
    ...flags,
    blueprint,
    force: Boolean(flags.force),
    'business-mode': String(flags['business-mode'] || 'transfer_first')
  });
  commandThemeGenerate(siteSlug, {
    tone: flags['theme-tone'] || 'auto',
    recipe: flags['theme-recipe']
  });
  commandProvisionEnv(siteSlug, { force: true });
  commandInitContent(siteSlug);
  commandSeedCms(siteSlug);
  await commandSeedTopics(siteSlug, {
    count: topicCount,
    status: String(flags.status || 'brief_ready'),
    replace: replaceTopics,
    source,
    locale: flags.locale
  });
  commandHandoffPack(siteSlug);

  const siteDir = resolveSiteDir(siteSlug);
  const cmsMutations = path.join(siteDir, 'seed-content', 'sanity.mutations.json');
  const topicMutations = path.join(siteDir, 'seed-content', 'topic-candidates.mutations.json');
  const applied = [];
  if (applySanity) {
    applied.push(await applySanityMutationsFile(path.relative(WORKSPACE_ROOT, cmsMutations)));
    applied.push(await applySanityMutationsFile(path.relative(WORKSPACE_ROOT, topicMutations)));
  }

  const normalizedBlueprint = ensureBusinessDefaults(loadSiteBlueprint(siteSlug));
  const envGenerated = parseEnvFile(path.join(siteDir, '.env.generated'));
  const registryEntry = upsertSiteRegistryEntry(siteSlug, normalizedBlueprint, {
    sanityProjectId: envGenerated.SANITY_PROJECT_ID || '',
    sanityDataset: envGenerated.SANITY_DATASET || normalizedBlueprint.publishingTarget?.dataset || 'production',
    webBaseUrl: envGenerated.NEXT_PUBLIC_SITE_URL || '',
    automationStatus: 'inactive',
    domainStatus: 'pending',
    ownerType: 'internal'
  });

  const summary = {
    siteSlug,
    blueprint,
    topicCount,
    source,
    theme: {
      recipe: normalizedBlueprint.themeProfile?.recipe || DEFAULT_THEME_RECIPE,
      tone: normalizedBlueprint.themeProfile?.tone || 'editorial'
    },
    applySanity,
    outputs: {
      blueprintPath: resolveSiteBlueprintPath(siteSlug),
      envPath: path.join(siteDir, '.env.generated'),
      cmsMutations: path.relative(WORKSPACE_ROOT, cmsMutations),
      topicMutations: path.relative(WORKSPACE_ROOT, topicMutations),
      handoffManifest: path.join(siteDir, 'handoff', 'manifest.json'),
      registry: path.relative(WORKSPACE_ROOT, SITE_REGISTRY_PATH)
    },
    applied,
    registryEntry,
    nextSteps: [
      'Import/update n8n workflows for this site context',
      'Run prepopulate_bulk_runner in n8n',
      'Deploy apps/web and connect domain DNS',
      'Transfer credentials using docs/credentials-transfer-template.md'
    ]
  };

  console.log(JSON.stringify(summary, null, 2));
}

function stripSanitySystemFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripSanitySystemFields(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const next = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === '_rev' || key === '_createdAt' || key === '_updatedAt') continue;
    if (nested === undefined) continue;
    next[key] = stripSanitySystemFields(nested);
  }
  return next;
}

async function fetchSanitySiteDocuments(siteSlug) {
  const env = loadWorkspaceEnv();
  const projectId = env.SANITY_PROJECT_ID;
  const dataset = env.SANITY_DATASET || 'production';
  const apiVersion = env.SANITY_API_VERSION || '2025-01-01';
  const readToken = env.SANITY_READ_TOKEN || env.SANITY_WRITE_TOKEN;

  if (!projectId || !readToken) {
    throw new Error('Missing SANITY_PROJECT_ID or SANITY_READ_TOKEN for release export.');
  }

  const docTypes = [
    'siteSettings',
    'category',
    'tag',
    'promptPreset',
    'topicCandidate',
    'article',
    'qaLog',
    'generationRun',
    'legalPage'
  ];

  const escapedSiteSlug = String(siteSlug).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const query = `*[_type in ${JSON.stringify(docTypes)} && siteSlug=="${escapedSiteSlug}"]|order(_type asc,_updatedAt asc)`;
  const url = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${readToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sanity query failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  const docs = Array.isArray(payload?.result) ? payload.result : [];
  return docs;
}

async function commandReleaseSite(siteSlug, flags = {}) {
  if (!siteSlug) throw new Error('Missing <site-slug>');
  const blueprint = ensureBusinessDefaults(loadSiteBlueprint(siteSlug));
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
  const siteDir = resolveSiteDir(siteSlug);
  const releaseDir = path.join(siteDir, 'handoff', 'release');
  ensureDir(releaseDir);

  commandHandoffPack(siteSlug);

  const summary = {
    siteSlug: safeSiteSlug,
    generatedAt: new Date().toISOString(),
    fromSanity: Boolean(flags['from-sanity']),
    files: {
      handoffManifest: path.join(siteDir, 'handoff', 'manifest.json')
    },
    counts: {},
    warnings: []
  };

  if (flags['from-sanity']) {
    const rawDocs = await fetchSanitySiteDocuments(safeSiteSlug);
    const docs = rawDocs.map((doc) => stripSanitySystemFields(doc));
    const byType = docs.reduce((acc, doc) => {
      const key = doc?._type || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const mutations = { mutations: docs.map((doc) => ({ createOrReplace: doc })) };
    const docDumpPath = path.join(releaseDir, 'sanity-site.documents.json');
    const mutationsPath = path.join(releaseDir, 'sanity-site.mutations.json');
    writeJson(docDumpPath, {
      siteSlug: safeSiteSlug,
      count: docs.length,
      docs
    });
    writeJson(mutationsPath, mutations);

    const imageAssetRefs = Array.from(
      new Set(
        docs
          .filter((doc) => doc?._type === 'article')
          .map((doc) => doc?.coverImage?.asset?._ref)
          .filter(Boolean)
      )
    );

    summary.files.documents = docDumpPath;
    summary.files.mutations = mutationsPath;
    summary.counts = byType;
    summary.imageAssetRefs = imageAssetRefs;
    if (imageAssetRefs.length > 0) {
      summary.warnings.push(
        'Image asset refs point to source Sanity project assets; for full transfer across projects, re-upload assets or run an asset migration step.'
      );
    }
  } else {
    summary.warnings.push('Sanity export skipped. Run again with --from-sanity to include live content export.');
  }

  summary.deliveryMode = blueprint.businessMode || 'transfer_first';
  const summaryPath = path.join(releaseDir, 'release-summary.json');
  writeJson(summaryPath, summary);
  console.log(JSON.stringify(summary, null, 2));
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
      checks.push({ name: 'blueprint_business_mode', ok: ['transfer_first', 'managed'].includes(String(blueprint.businessMode || 'transfer_first')) });
      checks.push({
        name: 'blueprint_theme_profile',
        ok: typeof blueprint.themeProfile?.recipe === 'string' && typeof blueprint.themeProfile?.tone === 'string'
      });
      checks.push({
        name: 'blueprint_theme_palette',
        ok: Boolean(blueprint.theme?.palette?.paper && blueprint.theme?.palette?.ink && blueprint.theme?.palette?.rust && blueprint.theme?.palette?.sage && blueprint.theme?.palette?.coal)
      });
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
  checks.push({ name: 'site_registry_exists', ok: exists(SITE_REGISTRY_PATH), path: SITE_REGISTRY_PATH });

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
  const blueprint = ensureBusinessDefaults(loadSiteBlueprint(siteSlug));
  const siteDir = resolveSiteDir(siteSlug);
  const handoffDir = path.join(siteDir, 'handoff');
  ensureDir(handoffDir);

  const manifest = {
    siteSlug,
    createdAt: new Date().toISOString(),
    blueprintPath: `sites/${siteSlug}/site.blueprint.json`,
    brandName: blueprint.brandName,
    businessMode: blueprint.businessMode,
    delivery: blueprint.delivery,
    publishingTarget: blueprint.publishingTarget?.kind,
    files: [
      `sites/${siteSlug}/site.blueprint.json`,
      `sites/${siteSlug}/.env.generated`,
      `sites/${siteSlug}/seed-content/sanity.mutations.json`,
      `sites/${siteSlug}/seed-content/topic-candidates.mutations.json`,
      `sites/registry.json`,
      'docs/handoff-buyer-checklist.md',
      'docs/credentials-transfer-template.md',
      'docs/runbook.md',
      'docs/architecture.md',
      'docs/factory.md',
      'docs/cost-tiers.md'
    ],
    notes: [
      'Replace placeholder contact/legal details before sale.',
      'Transfer secrets via password manager, not plaintext files.',
      'Sanity should be dedicated per sold site before final transfer.',
      'If using managed add-on, document SLA, fee, and exit/export process explicitly.'
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
      case 'theme-generate':
        commandThemeGenerate(positional[0], flags);
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
      case 'launch-site':
        await commandLaunchSite(positional[0], flags);
        break;
      case 'release-site':
        await commandReleaseSite(positional[0], flags);
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
