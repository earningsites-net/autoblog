#!/usr/bin/env node

import './load-local-env.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  displayPath,
  resolveRuntimePaths,
  resolveSiteBlueprintPath as resolveSourceSiteBlueprintPath,
  resolveSiteHandoffDir as resolveRuntimeSiteHandoffDir,
  resolveSiteHandoffFile as resolveRuntimeSiteHandoffFile,
  resolveSiteReadmePath as resolveSourceSiteReadmePath,
  resolveSiteRuntimeDir as resolveRuntimeSiteDir,
  resolveSiteRuntimeEnvPath as resolveRuntimeSiteEnvPath,
  resolveSiteSeedContentDir as resolveRuntimeSiteSeedContentDir,
  resolveSiteSeedContentFile as resolveRuntimeSiteSeedContentFile,
  resolveSiteSourceDir
} from './lib/runtime-paths.mjs';
import { createPortalStore } from './lib/portal-store.mjs';

const WORKSPACE_ROOT = process.cwd();
const SITES_SOURCE_ROOT = path.join(WORKSPACE_ROOT, 'sites');
const TEMPLATES_ROOT = path.join(SITES_SOURCE_ROOT, 'templates');
const RUNTIME_PATHS = resolveRuntimePaths({ workspaceRoot: WORKSPACE_ROOT, env: process.env });
const SITE_REGISTRY_PATH = RUNTIME_PATHS.registryPath;

function usage() {
  console.log(`
Usage:
  autoblog new <site-slug> --blueprint <template-id> [--brand-name "Brand"] [--force]
  autoblog theme-generate <site-slug> [--tone auto|editorial|luxury|wellness|playful|technical] [--recipe bold_magazine|editorial_luxury|warm_wellness|playful_kids|technical_minimal|noir_luxury_dark|midnight_wellness_dark|arcade_play_dark]
  autoblog init-content <site-slug>
  autoblog provision-env <site-slug> [--force]
  autoblog seed-cms <site-slug>
  autoblog seed-topics <site-slug> [--count 30] [--status brief_ready] [--replace] [--source suggest|synthetic] [--selector auto|heuristic|hybrid|llm]
  autoblog discover-topics <site-slug> [--count 30] [--status brief_ready] [--replace] [--source suggest|synthetic] [--selector auto|heuristic|hybrid|llm]
  autoblog launch-site <site-slug> [--blueprint generic-editorial-magazine] [--brand-name "Brand"] [--topic-count 60] [--source suggest|synthetic] [--theme-tone auto|editorial|luxury|wellness|playful|technical] [--theme-recipe <recipe>] [--apply-sanity]
  autoblog release-site <site-slug> [--from-sanity]
  autoblog deploy <site-slug>
  autoblog doctor <site-slug>
  autoblog set-studio-url <site-slug> --studio-url <url> [--portal-database-url <url>]
  autoblog handoff-site <site-slug> --owner-email <email> [--billing-mode customer_paid|incubating|complimentary] [--temp-password <password>] [--revoke-other-owners] [--portal-database-url <url>]
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
      paper: '#FFF4F7',
      ink: '#2F2328',
      rust: '#D9777F',
      sage: '#C8A39C',
      coal: '#24191F'
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
    blueprint.niche?.editorialPrompt,
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

function getEditorialPrompt(blueprint) {
  return String(blueprint?.niche?.editorialPrompt || '').trim();
}

function buildSiteAuthorProfiles(blueprint, siteSlug) {
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
  const primaryNiche = String(blueprint?.niche?.primaryNiche || blueprint?.brandName || 'the publication').trim();
  const focus = primaryNiche.toLowerCase();
  const profiles = [
    {
      slug: 'maya-chen',
      name: 'Maya Chen',
      role: 'Senior Staff Writer',
      bio: `Maya covers ${focus} with an emphasis on practical analysis, products, and real-world impact.`
    },
    {
      slug: 'jordan-blake',
      name: 'Jordan Blake',
      role: 'Features Editor',
      bio: `Jordan specializes in turning complex ${focus} topics into clear, useful explainers for everyday readers.`
    },
    {
      slug: 'avery-patel',
      name: 'Avery Patel',
      role: 'Industry Analyst',
      bio: `Avery writes about trends, platforms, and strategic shifts in ${focus}, with attention to what matters in practice.`
    }
  ];

  return profiles.map((profile) => ({
    _id: scopedDocId('author', safeSiteSlug, profile.slug),
    _type: 'authorProfile',
    siteSlug: safeSiteSlug,
    name: profile.name,
    slug: { current: profile.slug },
    role: profile.role,
    bio: profile.bio
  }));
}

function buildBriefOutline(query, templateType) {
  if (templateType === 'checklist') {
    return [
      '- Open by clarifying why this checklist matters for the reader right now.',
      '- Organize the checklist into phases or priorities that make sense for this specific topic.',
      '- Keep only the sections that materially help the reader; do not add generic filler headings.',
      '- End with a short takeaway or next-step note if it improves clarity.'
    ].join('\n');
  }
  if (templateType === 'list') {
    return [
      '- Lead with the strongest or most relevant options first.',
      '- Group ideas into distinctive angles instead of repeating a stock list structure.',
      '- Use sub-sections only when they clarify differences, examples, or tradeoffs.',
      '- Avoid generic headings unless they are genuinely the best fit for this topic.'
    ].join('\n');
  }
  if (templateType === 'how-to') {
    return [
      '- Explain prerequisites only if they are truly necessary for this topic.',
      '- Structure the process around real steps, decisions, or milestones specific to the query.',
      '- Add examples, caveats, or troubleshooting only where they create real value.',
      '- Finish with a concise validation, recap, or next-step section if appropriate.'
    ].join('\n');
  }
  return [
    '- Choose a structure that fits the topic instead of reusing stock headings.',
    '- Use 3 to 5 topic-specific sections with bespoke H2/H3 labels.',
    '- Include examples, comparisons, tradeoffs, or edge cases only when genuinely relevant.',
    '- End with a concise takeaway, future-looking note, or practical next step when useful.'
  ].join('\n');
}

function buildTopicBrief(query, templateType, blueprint) {
  const primaryNiche = String(blueprint?.niche?.primaryNiche || blueprint?.brandName || 'the publication').trim();
  const editorialPrompt = getEditorialPrompt(blueprint);
  const nicheClause = editorialPrompt
    ? `Align the framing with this editorial context: ${editorialPrompt}`
    : `Keep the framing aligned with the publication focus on ${primaryNiche}.`;

  return {
    angle: `Deliver useful, specific, publication-quality coverage of ${query}. ${nicheClause}`,
    audience: `Readers interested in ${primaryNiche} who expect clear, relevant, well-structured coverage.`,
    outlineMarkdown: buildBriefOutline(query, templateType),
    faqIdeas: [
      `What should readers understand first about ${query}?`,
      `What are the most useful examples or use cases for ${query}?`,
      `What mistakes should I avoid with ${query}?`
    ]
  };
}

const TOPIC_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'best', 'by', 'for', 'from', 'how', 'in', 'into', 'is', 'it',
  'its', 'of', 'on', 'or', 'the', 'their', 'this', 'to', 'vs', 'versus', 'what', 'why', 'with'
]);

const TOPIC_FORMAT_TOKENS = new Set([
  'analysis', 'approach', 'approaches', 'beginner', 'beginners', 'case', 'cases', 'checklist', 'clearly',
  'compare', 'comparison', 'comparisons', 'example', 'examples', 'explained', 'future', 'guide', 'guides',
  'idea', 'ideas', 'impact', 'industry', 'mistake', 'mistakes', 'outlook', 'overview', 'practice',
  'practices', 'step', 'tips', 'trend', 'trends', 'use', 'usecase', 'workflow', 'workflows', 'year'
]);

const TOPIC_VARIETY_PATTERNS = [
  {
    format: 'guide',
    when: () => true,
    build: (base) => base
  },
  {
    format: 'guide',
    when: (base) => !/\bguide\b/i.test(base),
    build: (base) => `${base} guide`
  },
  {
    format: 'examples',
    when: (base) => !/\bexamples?\b/i.test(base),
    build: (base) => `${base} examples`
  },
  {
    format: 'use-cases',
    when: (base) => !/\buse cases?\b|\bapplications?\b/i.test(base),
    build: (base) => `${base} use cases`
  },
  {
    format: 'trends',
    when: (base) => /\b(ai|automation|tool|platform|market|industry|future|content|finance|healthcare|education|cybersecurity|commerce)\b/i.test(base)
      && !/\btrends?\b|\bfuture\b|\boutlook\b|\bforecast\b|20\d{2}/i.test(base),
    build: (base) => `${base} trends`
  },
  {
    format: 'comparison',
    when: (base) => /\btools?\b|\bplatforms?\b|\bsoftware\b|\bapps?\b|\bassistants?\b/i.test(base)
      && !/\bcompare\b|\bcomparison\b|\bversus\b|\bvs\b/i.test(base),
    build: (base) => `${base} comparison`
  },
  {
    format: 'industry-analysis',
    when: (base) => /\bindustry\b|\bmarket\b|\bbusiness\b|\bbusinesses\b|\bstartup\b|\bstartups\b|\bfinance\b|\bbanking\b|\be-commerce\b|\bmarketing\b|\bcustomer support\b/i.test(base)
      && !/\bindustry analysis\b|\bmarket analysis\b/i.test(base),
    build: (base) => `${base} industry analysis`
  },
  {
    format: 'guide',
    when: (base) => !/\bexplained\b/i.test(base),
    build: (base) => `${base} explained`
  }
];

function singularizeToken(token) {
  if (!token) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ses') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 4 && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function normalizeTopicToken(token) {
  let value = String(token || '').toLowerCase().trim();
  if (!value) return '';
  if (/^20\d{2}$/.test(value)) return 'year';
  value = value.replace(/[^a-z0-9]+/g, '');
  if (!value) return '';

  const aliases = {
    changing: 'impact',
    transforming: 'impact',
    reshaping: 'impact',
    revolutionizing: 'impact',
    redefining: 'impact',
    application: 'usecase',
    applications: 'usecase',
    example: 'usecase',
    examples: 'usecase',
    case: 'usecase',
    cases: 'usecase',
    businesses: 'business',
    owners: 'owner',
    platforms: 'platform',
    tools: 'tool',
    trends: 'trend',
    comparisons: 'comparison',
    guides: 'guide'
  };

  value = aliases[value] || value;
  return singularizeToken(value);
}

function tokenizeTopicQuery(query, options = {}) {
  const semantic = Boolean(options.semantic);
  const stopwords = semantic ? TOPIC_STOPWORDS : null;

  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((part) => normalizeTopicToken(part))
    .filter(Boolean)
    .filter((part) => !stopwords || !stopwords.has(part))
    .filter((part) => !(semantic && TOPIC_FORMAT_TOKENS.has(part)));
}

function canonicalizeTopicQuery(query) {
  return tokenizeTopicQuery(query).join(' ');
}

function buildTopicSemanticKey(query) {
  return tokenizeTopicQuery(query, { semantic: true }).join(' ');
}

function topicTokenSet(query) {
  return new Set(tokenizeTopicQuery(query, { semantic: true }));
}

function jaccardSimilarity(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function areTopicQueriesNearDuplicate(left, right) {
  const leftCanonical = canonicalizeTopicQuery(left);
  const rightCanonical = canonicalizeTopicQuery(right);
  if (!leftCanonical || !rightCanonical) return false;
  if (leftCanonical === rightCanonical) return true;

  const leftSemantic = buildTopicSemanticKey(left);
  const rightSemantic = buildTopicSemanticKey(right);
  if (leftSemantic && rightSemantic && leftSemantic === rightSemantic) return true;

  const leftTokens = topicTokenSet(left);
  const rightTokens = topicTokenSet(right);
  const overlap = jaccardSimilarity(leftTokens, rightTokens);
  return overlap >= 0.74;
}

function extractTopicFormat(query) {
  const raw = String(query || '').toLowerCase();
  if (/compare|comparison|versus|\bvs\b/.test(raw)) return 'comparison';
  if (/use cases?|applications?/.test(raw)) return 'use-cases';
  if (/examples?/.test(raw)) return 'examples';
  if (/trend|forecast|future|outlook|20\d{2}/.test(raw)) return 'trends';
  if (/industry analysis|market analysis|\bindustry\b|\bmarket\b/.test(raw)) return 'industry-analysis';
  return 'guide';
}

function buildSyntheticTopicVariants(seed) {
  const base = String(seed || '').trim();
  if (!base) return [];

  const out = [];
  for (const pattern of TOPIC_VARIETY_PATTERNS) {
    if (typeof pattern.when === 'function' && !pattern.when(base)) continue;
    const query = String(pattern.build(base) || '').trim();
    if (!query) continue;
    if (out.some((item) => areTopicQueriesNearDuplicate(item.query, query))) continue;
    out.push({ query, format: pattern.format, source: 'synthetic' });
  }
  return out;
}

function stripCodeFences(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const firstNewline = trimmed.indexOf('\n');
  let content = firstNewline >= 0 ? trimmed.slice(firstNewline + 1) : trimmed.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  return content.trim();
}

function extractOpenAiResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const content of item.content) {
        if (typeof content?.text === 'string' && content.text.trim()) return content.text;
      }
    }
  }

  if (Array.isArray(payload?.choices) && typeof payload.choices[0]?.message?.content === 'string') {
    return payload.choices[0].message.content;
  }

  throw new Error('Unable to extract text from OpenAI response');
}

function generateTopicQueries(seedTopics, targetCount) {
  const perSeedVariants = seedTopics
    .map((seed) => buildSyntheticTopicVariants(seed).map((item) => item.query))
    .filter((items) => items.length > 0);

  const out = [];
  const accepted = [];
  let cursor = 0;
  while (out.length < Math.max(1, targetCount)) {
    let addedThisRound = false;
    for (const list of perSeedVariants) {
      const candidate = list[cursor];
      if (!candidate) continue;
      if (accepted.some((existing) => areTopicQueriesNearDuplicate(existing, candidate))) continue;
      accepted.push(candidate);
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

function inferCategoryHintKeywords(slug, title, description) {
  const haystack = `${slug} ${title} ${description}`.toLowerCase();
  const hints = [];

  if (/news|updates/.test(haystack)) {
    hints.push('news', 'update', 'updates', 'latest', 'release', 'launch', 'announced');
  }
  if (/tools?|platform/.test(haystack)) {
    hints.push('tool', 'tools', 'platform', 'platforms', 'software', 'assistant', 'comparison', 'productivity');
  }
  if (/real[- ]life|use cases?|applications?/.test(haystack)) {
    hints.push('application', 'applications', 'usecase', 'usecases', 'example', 'examples', 'workflow', 'healthcare', 'education', 'support', 'personal');
  }
  if (/industry|business/.test(haystack)) {
    hints.push('industry', 'business', 'market', 'marketing', 'startup', 'finance', 'banking', 'commerce', 'operations', 'enterprise');
  }
  if (/guides?|tutorials?/.test(haystack)) {
    hints.push('guide', 'guides', 'tutorial', 'tutorials', 'explained', 'basics');
  }
  if (/trend|future/.test(haystack)) {
    hints.push('trend', 'trends', 'future', 'forecast', 'outlook');
  }

  return tokenizeForMatching(hints.join(' '));
}

function buildCategoryProfiles(categories) {
  return (Array.isArray(categories) ? categories : []).map((category, index) => {
    const slug = String(category?.slug || '').trim();
    const title = String(category?.title || '').trim();
    const description = String(category?.description || '').trim();
    const keywordSet = new Set([
      ...tokenizeForMatching(slug.replace(/-/g, ' ')),
      ...tokenizeForMatching(title),
      ...tokenizeForMatching(description),
      ...inferCategoryHintKeywords(slug, title, description)
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
  const buildCategoryAnchor = (profile) => {
    const title = String(profile?.title || '').trim();
    const description = String(profile?.description || '').trim();
    if (!description) return title;
    const withinMatch = description.match(/\bwithin\s+([^.,]+)/i);
    const context = String(withinMatch?.[1] || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!context) return title;
    if (title.toLowerCase().includes(context.toLowerCase())) return title;
    if (/\bartificial intelligence\b/i.test(context) && /\bai\b/i.test(title)) return title;
    return `${context} ${title}`;
  };

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
    const anchor = buildCategoryAnchor(profile);
    list.push(`${anchor} use cases`);
    list.push(`${anchor} trends`);
    list.push(`${anchor} comparison`);
    list.push(`${anchor} industry analysis`);
    list.push(`${anchor} guide`);
    list.push(`${anchor} examples`);
    map.set(profile.slug, uniqueStrings(list));
  }
  return map;
}

function selectDiverseTopicCandidates(candidatePool, targetCount, tracker) {
  const selected = [];
  const usedFormats = new Set();

  for (let pass = 0; pass < 2 && selected.length < targetCount; pass += 1) {
    for (const candidate of candidatePool) {
      if (selected.length >= targetCount) break;
      if (selected.some((item) => item.query === candidate.query)) continue;
      if (pass === 0 && usedFormats.has(candidate.format)) continue;
      if (tracker.has(candidate.query)) continue;
      selected.push(candidate);
      usedFormats.add(candidate.format);
      tracker.add(candidate.query);
    }
  }

  return selected;
}

function selectBalancedHeuristicTopics(profiles, candidatePools, targetCount, tracker) {
  const output = [];
  const flatPool = [];
  for (const profile of profiles) {
    const items = candidatePools.get(profile.slug) || [];
    for (const item of items) flatPool.push(item);
  }

  while (output.length < targetCount) {
    let addedThisPass = false;
    for (const profile of profiles) {
      if (output.length >= targetCount) break;
      const selected = selectDiverseTopicCandidates(candidatePools.get(profile.slug) || [], 1, tracker);
      if (!selected.length) continue;
      output.push(selected[0]);
      addedThisPass = true;
    }
    if (!addedThisPass) break;
  }

  if (output.length < targetCount) {
    output.push(...selectDiverseTopicCandidates(flatPool, targetCount - output.length, tracker));
  }

  return output.slice(0, targetCount);
}

function createTopicUniquenessTracker(existingQueries = []) {
  const entries = [];
  const canonicalSet = new Set();
  const semanticSet = new Set();

  const register = (query) => {
    const canonical = canonicalizeTopicQuery(query);
    if (!canonical) return;
    const semantic = buildTopicSemanticKey(query);
    entries.push({ query, canonical, semantic, tokens: topicTokenSet(query) });
    canonicalSet.add(canonical);
    if (semantic) semanticSet.add(semantic);
  };

  for (const query of existingQueries) register(query);

  return {
    has(query) {
      const canonical = canonicalizeTopicQuery(query);
      if (!canonical) return true;
      const semantic = buildTopicSemanticKey(query);
      if (canonicalSet.has(canonical)) return true;
      if (semantic && semanticSet.has(semantic)) return true;
      return entries.some((entry) => areTopicQueriesNearDuplicate(entry.query, query));
    },
    add(query) {
      register(query);
    }
  };
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

function resolveTopicDiscoverySelector(flags = {}) {
  const selector = String(
    flags.selector ||
      flags.selection ||
      process.env.TOPIC_DISCOVERY_SELECTOR ||
      process.env.TOPIC_DISCOVERY_SELECTION_MODE ||
      'auto'
  )
    .trim()
    .toLowerCase();
  const model = String(
    flags['selector-model'] ||
      flags['selection-model'] ||
      process.env.TOPIC_DISCOVERY_MODEL ||
      process.env.TEXT_MODEL_DRAFT ||
      'gpt-4.1-mini'
  ).trim();

  return {
    selector,
    model,
    useLlm:
      selector === 'llm' ||
      selector === 'hybrid' ||
      (selector === 'auto' && Boolean(String(process.env.OPENAI_API_KEY || '').trim()))
  };
}

function synthesizeQueriesForCategory(baseSeeds, perCategoryTarget) {
  const synthetic = generateTopicQueries(baseSeeds, Math.max(perCategoryTarget * 3, 12));
  return synthetic.slice(0, Math.max(perCategoryTarget * 2, 8));
}

function buildCandidatePool(queries, categorySlug, source, existingCandidates = []) {
  const out = [...existingCandidates];
  for (const query of queries) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) continue;
    if (out.some((item) => areTopicQueriesNearDuplicate(item.query, normalizedQuery))) continue;
    out.push({
      query: normalizedQuery,
      categorySlug,
      source,
      format: extractTopicFormat(normalizedQuery)
    });
  }
  return out.slice(existingCandidates.length);
}

async function selectTopicCandidatesWithLlm({
  siteSlug,
  blueprint,
  profiles,
  candidatePool,
  targetCount,
  existingQueries,
  model,
  tracker
}) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return { ok: false, reason: 'missing-openai-api-key', selected: [] };
  if (!candidatePool.length) return { ok: false, reason: 'empty-candidate-pool', selected: [] };

  const categories = profiles.map((profile) => ({
    slug: profile.slug,
    title: profile.title,
    description: profile.description
  }));
  const editorialPrompt = getEditorialPrompt(blueprint);
  const payload = {
    siteSlug,
    primaryNiche: String(blueprint?.niche?.primaryNiche || blueprint?.brandName || '').trim(),
    editorialPrompt,
    targetCount,
    categories,
    existingQueries: existingQueries.slice(0, 40),
    candidates: candidatePool.slice(0, 80).map((candidate) => ({
      query: candidate.query,
      categorySlug: candidate.categorySlug,
      format: candidate.format,
      source: candidate.source
    }))
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'Return ONLY valid JSON with schema {"selected":[{"query":string,"categorySlug":string,"reason":string}]}. You are curating topic candidates for a professional editorial site. Choose ONLY from the provided candidates. Do not invent new queries, categories, dates, or entities. Prefer distinct semantic stems, strong editorial variety, balanced category coverage, and search-friendly phrasing. Reject trivial rewrites and near-duplicates of existing site topics or articles.'
        },
        {
          role: 'user',
          content: JSON.stringify(payload)
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI topic selection failed (${response.status}): ${text}`);
  }

  const raw = await response.json();
  const parsed = JSON.parse(stripCodeFences(extractOpenAiResponseText(raw)));
  const requested = Array.isArray(parsed?.selected) ? parsed.selected : [];
  const selected = [];
  const used = new Set();

  for (const item of requested) {
    if (selected.length >= targetCount) break;
    const query = String(item?.query || '').trim();
    if (!query) continue;
    const matched =
      candidatePool.find((candidate) => candidate.query === query) ||
      candidatePool.find((candidate) => candidate.query.toLowerCase() === query.toLowerCase());
    if (!matched) continue;
    if (used.has(matched.query.toLowerCase())) continue;
    if (tracker.has(matched.query)) continue;

    const requestedCategorySlug = String(item?.categorySlug || '').trim();
    const categorySlug = profiles.some((profile) => profile.slug === requestedCategorySlug)
      ? requestedCategorySlug
      : matched.categorySlug;

    tracker.add(matched.query);
    used.add(matched.query.toLowerCase());
    selected.push({
      query: matched.query,
      categorySlug,
      format: matched.format,
      source: matched.source,
      reason: String(item?.reason || '').trim()
    });
  }

  return {
    ok: selected.length > 0,
    reason: selected.length ? 'selected' : 'empty-selection',
    selected
  };
}

async function discoverTopicQueriesByCategory({
  siteSlug,
  blueprint,
  seedTopics,
  categories,
  targetCount,
  locale,
  excludedSubtopics,
  existingQueries = [],
  selectorConfig = resolveTopicDiscoverySelector()
}) {
  const profiles = buildCategoryProfiles(categories);
  if (!profiles.length) {
    throw new Error('No categories found in blueprint. Categories are required for dynamic distribution.');
  }

  const perCategoryTarget = Math.max(1, Math.ceil(targetCount / profiles.length));
  const categorySeedMap = buildCategorySeedMap(seedTopics, profiles);
  const candidatePools = new Map();
  const tracker = createTopicUniquenessTracker(existingQueries);

  for (const profile of profiles) {
    const seeds = categorySeedMap.get(profile.slug) || [];
    const candidatePool = [];
    let requestCount = 0;
    const maxRequestsPerCategory = 18;

    for (const seed of seeds) {
      if (requestCount >= maxRequestsPerCategory) break;
      requestCount += 1;

      let suggestions = [];
      try {
        suggestions = await fetchGoogleSuggest(seed, locale);
      } catch {
        suggestions = [];
      }

      for (const suggestion of suggestions) {
        if (!isSafeTopicQuery(suggestion, excludedSubtopics)) continue;
        const assigned = classifyQueryToCategory(suggestion, profiles);
        if (!assigned || assigned.slug !== profile.slug) continue;
        candidatePool.push(...buildCandidatePool([suggestion], profile.slug, 'suggest', candidatePool));
      }
    }

    if (candidatePool.length < perCategoryTarget) {
      const fallback = synthesizeQueriesForCategory(seeds, perCategoryTarget);
      candidatePool.push(...buildCandidatePool(fallback, profile.slug, 'synthetic', candidatePool));
    }

    candidatePools.set(
      profile.slug,
      candidatePool.filter((candidate) => isSafeTopicQuery(candidate.query, excludedSubtopics))
    );
  }

  const candidatePool = [];
  for (const profile of profiles) {
    for (const candidate of candidatePools.get(profile.slug) || []) {
      if (candidatePool.some((existing) => areTopicQueriesNearDuplicate(existing.query, candidate.query))) continue;
      candidatePool.push(candidate);
    }
  }

  let output = [];
  if (selectorConfig.useLlm) {
    try {
      const llm = await selectTopicCandidatesWithLlm({
        siteSlug,
        blueprint,
        profiles,
        candidatePool,
        targetCount,
        existingQueries,
        model: selectorConfig.model,
        tracker
      });
      output = llm.selected;
    } catch (error) {
      console.warn(`[autoblog] Warning: LLM topic selection failed, falling back to heuristics: ${error.message || error}`);
    }
  }

  if (output.length < targetCount) {
    output.push(...selectBalancedHeuristicTopics(profiles, candidatePools, targetCount - output.length, tracker));
  }

  if (output.length < targetCount) {
    const fallbackAll = buildCandidatePool(generateTopicQueries(seedTopics, targetCount * 4), '', 'synthetic');
    for (const candidate of fallbackAll) {
      if (output.length >= targetCount) break;
      if (!isSafeTopicQuery(candidate.query, excludedSubtopics)) continue;
      if (tracker.has(candidate.query)) continue;
      const assigned = classifyQueryToCategory(candidate.query, profiles) || profiles[0];
      tracker.add(candidate.query);
      output.push({
        query: candidate.query,
        categorySlug: assigned.slug,
        format: candidate.format,
        source: candidate.source
      });
    }
  }

  return output.slice(0, targetCount).map((candidate) => ({
    query: candidate.query,
    categorySlug: candidate.categorySlug
  }));
}

function buildTopicCandidateDoc(siteSlug, query, index, status, workflowRunId, categorySlug, blueprint) {
  const normalizedQuery = String(query).trim();
  const templateType = inferTemplateType(normalizedQuery);
  const targetKeyword = normalizedQuery;
  const supportingKeywords = uniqueStrings([
    `${normalizedQuery} for beginners`,
    `${normalizedQuery} checklist`,
    `${normalizedQuery} examples`
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
    brief: buildTopicBrief(normalizedQuery, templateType, blueprint),
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
  return resolveSiteSourceDir(WORKSPACE_ROOT, siteSlug);
}

function resolveSiteRuntimeDir(siteSlug) {
  return resolveRuntimeSiteDir(RUNTIME_PATHS, siteSlug);
}

function resolveSiteBlueprintPath(siteSlug) {
  return resolveSourceSiteBlueprintPath(WORKSPACE_ROOT, siteSlug);
}

function resolveSiteReadmePath(siteSlug) {
  return resolveSourceSiteReadmePath(WORKSPACE_ROOT, siteSlug);
}

function resolveSiteEnvPath(siteSlug) {
  return resolveRuntimeSiteEnvPath(RUNTIME_PATHS, siteSlug);
}

function resolveSiteSeedContentDir(siteSlug) {
  return resolveRuntimeSiteSeedContentDir(RUNTIME_PATHS, siteSlug);
}

function resolveSiteSeedContentFile(siteSlug, fileName) {
  return resolveRuntimeSiteSeedContentFile(RUNTIME_PATHS, siteSlug, fileName);
}

function resolveSiteHandoffDir(siteSlug) {
  return resolveRuntimeSiteHandoffDir(RUNTIME_PATHS, siteSlug);
}

function resolveSiteHandoffFile(siteSlug, fileName) {
  return resolveRuntimeSiteHandoffFile(RUNTIME_PATHS, siteSlug, fileName);
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

function loadRegistry() {
  if (!exists(SITE_REGISTRY_PATH)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      sites: []
    };
  }

  const parsed = readJson(SITE_REGISTRY_PATH);
  if (!Array.isArray(parsed?.sites)) {
    throw new Error(`Invalid site registry shape: ${SITE_REGISTRY_PATH}`);
  }
  return parsed;
}

function saveRegistry(registry) {
  const next = {
    version: Number(registry?.version || 1),
    updatedAt: new Date().toISOString(),
    sites: Array.isArray(registry?.sites) ? registry.sites : []
  };
  writeJson(SITE_REGISTRY_PATH, next);
  return next;
}

function parseListFlag(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeBillingMode(value, fallback = 'customer_paid') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'customer_paid' || raw === 'incubating' || raw === 'complimentary') {
    return raw;
  }
  return fallback;
}

function assertHttpUrl(value, label) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`Invalid ${label}`);
  }
}

function generateTempPassword(length = 22) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%&*-_=+';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += alphabet[bytes[index] % alphabet.length];
  }
  return out;
}

function buildHandoffChecklist({
  siteSlug,
  ownerEmail,
  portalRole,
  sanityProjectId,
  sanityDataset,
  webBaseUrl,
  studioUrl,
  tempPasswordGenerated
}) {
  const lines = [
    `# Site Handoff (${siteSlug})`,
    '',
    '## Portal',
    `- Owner email: ${ownerEmail}`,
    `- Granted role: ${portalRole}`,
    tempPasswordGenerated
      ? '- Temporary password was generated during handoff. Communicate it securely or force a reset immediately.'
      : '- Temporary password was provided explicitly during handoff. Communicate it securely or rotate it immediately.',
    '- Ask the buyer to log in at the portal and set a new password.',
    '',
    '## Sanity',
    `- Project ID: ${sanityProjectId || '(missing)'}`,
    `- Dataset: ${sanityDataset || 'production'}`,
    '- Invite the buyer to this project only, using their real email.',
    '- Do not share your own Sanity account.',
    '- Ensure the buyer does not have Organization Member access on your org.',
    '',
    '## Web / Hosting',
    `- Public site URL: ${webBaseUrl || '(missing)'}`,
    `- Studio URL: ${studioUrl || '(missing)'}`,
    '- Transfer or recreate the Vercel project/domain access as part of delivery.',
    '',
    '## Ops',
    '- Decide whether to revoke your own portal/site access after acceptance.',
    '- Keep runtime backups before removing any admin access.',
    ''
  ];
  return `${lines.join('\n')}\n`;
}

function loadWorkspaceEnv() {
  return {
    ...parseEnvFile(path.join(WORKSPACE_ROOT, 'infra', 'n8n', '.env')),
    ...parseEnvFile(path.join(WORKSPACE_ROOT, '.env')),
    ...process.env
  };
}

function resolveSiteSanityReadConfig(siteSlug) {
  const siteEnv = parseEnvFile(resolveSiteEnvPath(siteSlug));
  const workspaceEnv = loadWorkspaceEnv();
  return {
    projectId: siteEnv.SANITY_PROJECT_ID || workspaceEnv.SANITY_PROJECT_ID || '',
    dataset: siteEnv.SANITY_DATASET || workspaceEnv.SANITY_DATASET || 'production',
    apiVersion: siteEnv.SANITY_API_VERSION || workspaceEnv.SANITY_API_VERSION || '2025-01-01',
    readToken: siteEnv.SANITY_READ_TOKEN || siteEnv.SANITY_WRITE_TOKEN || workspaceEnv.SANITY_READ_TOKEN || workspaceEnv.SANITY_WRITE_TOKEN || ''
  };
}

async function runSanityQuery(config, query) {
  if (!config.projectId || !config.readToken) return null;

  const url = `https://${config.projectId}.api.sanity.io/v${config.apiVersion}/data/query/${config.dataset}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.readToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sanity query failed (${response.status}): ${text}`);
  }

  return response.json();
}

function loadLocalTopicQueryPreview(siteSlug) {
  const previewPath = resolveSiteSeedContentFile(siteSlug, 'topic-candidates.generated.json');
  if (!exists(previewPath)) return [];
  try {
    const payload = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
    const topics = Array.isArray(payload?.topics) ? payload.topics : [];
    return uniqueStrings(topics.flatMap((doc) => [doc?.query, doc?.targetKeyword]).filter(Boolean));
  } catch (error) {
    console.warn(`[autoblog] Warning: failed to read local topic preview for '${siteSlug}': ${error.message || error}`);
    return [];
  }
}

async function fetchExistingSiteTopicQueries(siteSlug) {
  const localQueries = loadLocalTopicQueryPreview(siteSlug);
  const config = resolveSiteSanityReadConfig(siteSlug);
  if (!config.projectId || !config.readToken) return localQueries;

  const escapedSiteSlug = String(siteSlug).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const query = `{
    "topics": *[_type=="topicCandidate" && siteSlug=="${escapedSiteSlug}"]{query,targetKeyword},
    "articles": *[_type=="article" && siteSlug=="${escapedSiteSlug}"]{title,seoTitle,"sourceTopicQuery":aiMeta.sourceTopicQuery,"targetKeyword":aiMeta.targetKeyword}
  }`;

  try {
    const payload = await runSanityQuery(config, query);
    const topics = Array.isArray(payload?.result?.topics) ? payload.result.topics : [];
    const articles = Array.isArray(payload?.result?.articles) ? payload.result.articles : [];
    return uniqueStrings([
      ...localQueries,
      ...topics.flatMap((doc) => [doc?.query, doc?.targetKeyword]),
      ...articles.flatMap((doc) => [doc?.title, doc?.seoTitle, doc?.sourceTopicQuery, doc?.targetKeyword])
    ].filter(Boolean));
  } catch (error) {
    console.warn(`[autoblog] Warning: failed to fetch existing site topics for '${siteSlug}': ${error.message || error}`);
    return localQueries;
  }
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
  const templateId = String(flags.blueprint || 'generic-editorial-magazine');
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

  const notesPath = resolveSiteReadmePath(siteSlug);
  if (!exists(notesPath) || flags.force) {
    fs.writeFileSync(
      notesPath,
      `# ${blueprint.brandName}\n\nGenerated from blueprint: ${templateId}\n\nFiles:\n- site.blueprint.json\n- runtime: .env.generated, seed-content/, handoff/\n`,
      'utf8'
    );
  }

  console.log(`Created site '${siteSlug}' from blueprint '${templateId}'`);
  console.log(`Blueprint: ${displayPath(WORKSPACE_ROOT, targetBlueprintPath)}`);
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
  const seedDir = resolveSiteSeedContentDir(siteSlug);
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
    { _id: scopedDocId('tag', safeSiteSlug, 'analysis'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Analysis', slug: { current: 'analysis' } },
    { _id: scopedDocId('tag', safeSiteSlug, 'explained'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Explained', slug: { current: 'explained' } },
    { _id: scopedDocId('tag', safeSiteSlug, 'trends'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Trends', slug: { current: 'trends' } },
    { _id: scopedDocId('tag', safeSiteSlug, 'beginner'), _type: 'tag', siteSlug: safeSiteSlug, title: 'Beginner', slug: { current: 'beginner' } }
  ];

  const authors = buildSiteAuthorProfiles(blueprint, safeSiteSlug);

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
  writeJson(path.join(seedDir, 'authors.json'), authors);
  writeJson(path.join(seedDir, 'prompt-presets.json'), promptPresets);
  writeJson(path.join(seedDir, 'topic-seeds.json'), {
    siteSlug,
    seedTopics: blueprint.seedTopics || []
  });

  console.log(`Initialized seed content for '${siteSlug}' in ${displayPath(WORKSPACE_ROOT, seedDir)}`);
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
  const envPath = resolveSiteEnvPath(siteSlug);
  ensureDir(path.dirname(envPath));
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
  console.log(`Generated/updated env file: ${displayPath(WORKSPACE_ROOT, envPath)}`);
}

function commandSeedCms(siteSlug) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
  const outputDir = resolveSiteSeedContentDir(siteSlug);
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
      monetization: {
        enabled: Boolean(blueprint.featureFlags?.adSlotsDefault),
        providerName: '',
        headHtml: '',
        placements: []
      },
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
    { slug: 'analysis', title: 'Analysis' },
    { slug: 'explained', title: 'Explained' },
    { slug: 'trends', title: 'Trends' },
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

  for (const author of buildSiteAuthorProfiles(blueprint, safeSiteSlug)) {
    mutations.push({
      createOrReplace: author
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
  console.log(`Generated Sanity seed payload: ${displayPath(WORKSPACE_ROOT, filePath)}`);
}

async function commandSeedTopics(siteSlug, flags) {
  const blueprint = loadSiteBlueprint(siteSlug);
  const outputDir = resolveSiteSeedContentDir(siteSlug);
  ensureDir(outputDir);

  const count = Math.max(1, Number(flags.count || 30));
  const source = String(flags.source || 'suggest').toLowerCase();
  const selectorConfig = resolveTopicDiscoverySelector(flags);
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
  const existingQueries = await fetchExistingSiteTopicQueries(siteSlug);
  let discovered = [];
  if (source === 'suggest') {
    discovered = await discoverTopicQueriesByCategory({
      siteSlug,
      blueprint,
      seedTopics,
      categories,
      targetCount: count,
      locale,
      excludedSubtopics,
      existingQueries,
      selectorConfig
    });
  } else if (source === 'synthetic') {
    const profiles = buildCategoryProfiles(categories);
    const tracker = createTopicUniquenessTracker(existingQueries);
    const fallback = buildCandidatePool(generateTopicQueries(seedTopics, count * 4), '', 'synthetic');
    for (const candidate of fallback) {
      if (discovered.length >= count) break;
      if (!isSafeTopicQuery(candidate.query, excludedSubtopics)) continue;
      if (tracker.has(candidate.query)) continue;
      const assigned = classifyQueryToCategory(candidate.query, profiles) || profiles[0];
      tracker.add(candidate.query);
      discovered.push({
        query: candidate.query,
        categorySlug: assigned.slug
      });
    }
  } else {
    throw new Error(`Unknown --source value "${source}". Use "suggest" or "synthetic".`);
  }

  if (!discovered.length) {
    throw new Error(`No topic candidates discovered for '${siteSlug}'`);
  }

  const workflowRunId = `seed-topics-${new Date().toISOString()}`;
  const safeSiteSlug = sanitizeSiteSlug(siteSlug);
  const docs = discovered
    .map((item, index) => buildTopicCandidateDoc(safeSiteSlug, item.query, index, status, workflowRunId, item.categorySlug, blueprint))
    .slice(0, count);

  const mutationOp = flags.replace ? 'createOrReplace' : 'createIfNotExists';
  const mutations = {
    mutations: docs.map((doc) => ({
      [mutationOp]: doc
    }))
  };

  const previewPath = resolveSiteSeedContentFile(siteSlug, 'topic-candidates.generated.json');
  const mutationsPath = resolveSiteSeedContentFile(siteSlug, 'topic-candidates.mutations.json');
  writeJson(previewPath, {
    siteSlug,
    count: docs.length,
    source,
    locale,
    status,
    workflowRunId,
    existingQueryCount: existingQueries.length,
    selector: selectorConfig.selector,
    selectionModel: selectorConfig.model,
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
  console.log(`Selection mode: ${selectorConfig.selector}${selectorConfig.useLlm ? ` (${selectorConfig.model})` : ''}`);
  console.log(`Locale: ${locale}`);
  console.log(`Category distribution: ${JSON.stringify(categoryDistribution)}`);
  console.log(`Mutation strategy: ${mutationOp}`);
  console.log(`Preview: ${displayPath(WORKSPACE_ROOT, previewPath)}`);
  console.log(`Sanity mutations: ${displayPath(WORKSPACE_ROOT, mutationsPath)}`);
}

async function commandLaunchSite(siteSlug, flags) {
  if (!siteSlug) throw new Error('Missing <site-slug>');

  const blueprint = String(flags.blueprint || 'generic-editorial-magazine');
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

  const cmsMutations = resolveSiteSeedContentFile(siteSlug, 'sanity.mutations.json');
  const topicMutations = resolveSiteSeedContentFile(siteSlug, 'topic-candidates.mutations.json');
  const applied = [];
  if (applySanity) {
    applied.push(await applySanityMutationsFile(cmsMutations));
    applied.push(await applySanityMutationsFile(topicMutations));
  }

  const normalizedBlueprint = ensureBusinessDefaults(loadSiteBlueprint(siteSlug));
  const envGenerated = parseEnvFile(resolveSiteEnvPath(siteSlug));
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
      blueprintPath: displayPath(WORKSPACE_ROOT, resolveSiteBlueprintPath(siteSlug)),
      envPath: displayPath(WORKSPACE_ROOT, resolveSiteEnvPath(siteSlug)),
      cmsMutations: displayPath(WORKSPACE_ROOT, cmsMutations),
      topicMutations: displayPath(WORKSPACE_ROOT, topicMutations),
      handoffManifest: displayPath(WORKSPACE_ROOT, resolveSiteHandoffFile(siteSlug, 'manifest.json')),
      registry: displayPath(WORKSPACE_ROOT, SITE_REGISTRY_PATH)
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
  const releaseDir = path.join(resolveSiteHandoffDir(siteSlug), 'release');
  ensureDir(releaseDir);

  commandHandoffPack(siteSlug);

  const summary = {
    siteSlug: safeSiteSlug,
    generatedAt: new Date().toISOString(),
    fromSanity: Boolean(flags['from-sanity']),
    files: {
      handoffManifest: displayPath(WORKSPACE_ROOT, resolveSiteHandoffFile(siteSlug, 'manifest.json'))
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
  const planPath = resolveSiteHandoffFile(siteSlug, 'deploy-plan.md');
  ensureDir(path.dirname(planPath));

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
    `- Review runtime env: \`${displayPath(WORKSPACE_ROOT, resolveSiteEnvPath(siteSlug))}\``,
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
  console.log(`Wrote deploy plan: ${displayPath(WORKSPACE_ROOT, planPath)}`);
}

function commandDoctor(siteSlug) {
  const sourceDir = resolveSiteDir(siteSlug);
  const runtimeDir = resolveSiteRuntimeDir(siteSlug);
  const blueprintPath = resolveSiteBlueprintPath(siteSlug);
  const checks = [];

  checks.push({ name: 'site_source_dir', ok: exists(sourceDir), path: sourceDir });
  checks.push({ name: 'site_runtime_dir', ok: exists(runtimeDir), path: runtimeDir });
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

  const envPath = resolveSiteEnvPath(siteSlug);
  checks.push({ name: 'env_generated_exists', ok: exists(envPath), path: envPath });

  const seedPayload = resolveSiteSeedContentFile(siteSlug, 'sanity.mutations.json');
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
  const handoffDir = resolveSiteHandoffDir(siteSlug);
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
      displayPath(WORKSPACE_ROOT, resolveSiteEnvPath(siteSlug)),
      displayPath(WORKSPACE_ROOT, resolveSiteSeedContentFile(siteSlug, 'sanity.mutations.json')),
      displayPath(WORKSPACE_ROOT, resolveSiteSeedContentFile(siteSlug, 'topic-candidates.mutations.json')),
      displayPath(WORKSPACE_ROOT, SITE_REGISTRY_PATH),
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

  writeJson(resolveSiteHandoffFile(siteSlug, 'manifest.json'), manifest);
  fs.writeFileSync(
    resolveSiteHandoffFile(siteSlug, 'README.md'),
    `# Handoff Pack (${blueprint.brandName})\n\nSee manifest.json for the list of files and transfer notes.\n`,
    'utf8'
  );

  console.log(`Generated handoff pack in ${displayPath(WORKSPACE_ROOT, handoffDir)}`);
}

async function commandHandoffSite(siteSlug, flags) {
  const normalizedSlug = sanitizeSiteSlug(siteSlug);
  if (!normalizedSlug) throw new Error('Missing <site-slug>');

  const ownerEmail = normalizeEmail(flags['owner-email']);
  if (!ownerEmail) {
    throw new Error('Missing required flag --owner-email');
  }

  const role = 'owner';
  const blueprint = ensureBusinessDefaults(loadSiteBlueprint(normalizedSlug));
  const siteEnv = parseEnvFile(resolveSiteEnvPath(normalizedSlug));
  const tempPassword = String(flags['temp-password'] || generateTempPassword());
  const tempPasswordGenerated = typeof flags['temp-password'] !== 'string' || flags['temp-password'].trim() === '';
  const revokeOthers = flags['revoke-other-owners'] === true;
  const keepEmails = uniqueStrings([
    ownerEmail,
    ...parseListFlag(flags['keep-email']),
    ...(flags['keep-admin'] === true ? [String(process.env.PORTAL_ADMIN_EMAIL || '')] : [])
  ]).map((item) => normalizeEmail(item));
  const webBaseUrl = String(flags['web-base-url'] || '').trim();
  const studioUrl = String(flags['studio-url'] || siteEnv.SANITY_STUDIO_URL || '').trim();
  const mode = String(
    flags.mode || (String(blueprint.businessMode || 'transfer_first') === 'managed' ? 'managed' : 'transfer')
  ).trim();
  const ownerType = String(flags['owner-type'] || (mode === 'managed' ? 'internal' : 'client')).trim();
  const billingMode = normalizeBillingMode(
    flags['billing-mode'],
    'customer_paid'
  );
  const portalStore = await createPortalStore({
    postgresUrl: flags['portal-database-url'] || process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL || ''
  });
  let user = null;
  let beforeAccess = [];
  let afterAccess = [];
  let revokedOwners = [];

  try {
    await portalStore.ensureSiteRecords(normalizedSlug);
    beforeAccess = await portalStore.listSiteAccess(normalizedSlug);
    user = await portalStore.createOrUpdateUser(ownerEmail, tempPassword);
    await portalStore.assignSiteAccess(user.id, normalizedSlug, role);
    await portalStore.patchEntitlement(normalizedSlug, {
      billingMode,
      status: billingMode === 'customer_paid' ? 'stopped' : 'active',
      billingStatus: billingMode === 'customer_paid' ? 'n/a' : 'n/a',
      stripeSubscriptionId: billingMode === 'customer_paid' ? '' : undefined,
      stripePriceId: billingMode === 'customer_paid' ? '' : undefined
    });
    if (revokeOthers && role === 'owner') {
      revokedOwners = await portalStore.revokeOtherOwners(normalizedSlug, keepEmails);
    }
    afterAccess = await portalStore.listSiteAccess(normalizedSlug);
  } catch (error) {
    await portalStore.close();
    throw error;
  }
  await portalStore.close();

  const registry = loadRegistry();
  const currentSite = Array.isArray(registry.sites)
    ? registry.sites.find((site) => sanitizeSiteSlug(site.siteSlug) === normalizedSlug)
    : null;

  const nextSite = {
    ...(currentSite || {}),
    siteSlug: normalizedSlug,
    ownerEmail,
    ownerType: ownerType === 'internal' ? 'internal' : 'client',
    mode: mode === 'managed' ? 'managed' : 'transfer',
    sanityProjectId: String(siteEnv.SANITY_PROJECT_ID || currentSite?.sanityProjectId || '').trim(),
    sanityDataset: String(siteEnv.SANITY_DATASET || currentSite?.sanityDataset || 'production').trim(),
    sanityApiVersion: String(siteEnv.SANITY_API_VERSION || currentSite?.sanityApiVersion || '2025-01-01').trim(),
    webBaseUrl: webBaseUrl || currentSite?.webBaseUrl || '',
    studioUrl: studioUrl || currentSite?.studioUrl || '',
    updatedAt: new Date().toISOString()
  };

  const nextSites = Array.isArray(registry.sites) ? [...registry.sites] : [];
  const siteIndex = nextSites.findIndex((site) => sanitizeSiteSlug(site.siteSlug) === normalizedSlug);
  if (siteIndex >= 0) nextSites[siteIndex] = nextSite;
  else nextSites.push(nextSite);
  saveRegistry({ ...registry, sites: nextSites });

  ensureDir(resolveSiteHandoffDir(normalizedSlug));
  commandHandoffPack(normalizedSlug);

  const handoffSummary = {
    siteSlug: normalizedSlug,
    ownerEmail,
    role,
    billingMode,
    runtimeEnvPath: resolveSiteEnvPath(normalizedSlug),
    registryPath: SITE_REGISTRY_PATH,
    webBaseUrl: nextSite.webBaseUrl,
    studioUrl: nextSite.studioUrl,
    sanityProjectId: nextSite.sanityProjectId,
    sanityDataset: nextSite.sanityDataset,
    createdPortalUser: Boolean(user?.created),
    tempPasswordGenerated,
    revokedOwners,
    beforeAccess,
    afterAccess
  };

  writeJson(resolveSiteHandoffFile(normalizedSlug, 'transfer-summary.json'), handoffSummary);
  fs.writeFileSync(
    resolveSiteHandoffFile(normalizedSlug, 'transfer-checklist.md'),
    buildHandoffChecklist({
      siteSlug: normalizedSlug,
      ownerEmail,
      portalRole: role,
      sanityProjectId: nextSite.sanityProjectId,
      sanityDataset: nextSite.sanityDataset,
      webBaseUrl: nextSite.webBaseUrl,
      studioUrl: nextSite.studioUrl,
      tempPasswordGenerated
    }),
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        siteSlug: normalizedSlug,
        portal: {
          provider: portalStore.provider,
          email: ownerEmail,
          role,
          billingMode,
          createdUser: Boolean(user?.created),
          tempPassword,
          tempPasswordGenerated,
          revokedOwners,
          beforeAccess,
          afterAccess
        },
        registry: {
          path: displayPath(WORKSPACE_ROOT, SITE_REGISTRY_PATH),
          ownerEmail: nextSite.ownerEmail,
          ownerType: nextSite.ownerType,
          mode: nextSite.mode,
          webBaseUrl: nextSite.webBaseUrl,
          studioUrl: nextSite.studioUrl
        },
        handoff: {
          summaryPath: displayPath(WORKSPACE_ROOT, resolveSiteHandoffFile(normalizedSlug, 'transfer-summary.json')),
          checklistPath: displayPath(WORKSPACE_ROOT, resolveSiteHandoffFile(normalizedSlug, 'transfer-checklist.md')),
          packPath: displayPath(WORKSPACE_ROOT, resolveSiteHandoffDir(normalizedSlug))
        },
        nextSteps: [
          'Invite the buyer to the Sanity project using their real email.',
          'Transfer or recreate Vercel/domain access for the buyer.',
          'Decide whether to revoke old owner access with --revoke-other-owners on a follow-up run.'
        ]
      },
      null,
      2
    )
  );
}

async function commandSetStudioUrl(siteSlug, flags) {
  const normalizedSlug = sanitizeSiteSlug(siteSlug);
  if (!normalizedSlug) throw new Error('Missing <site-slug>');

  const studioUrl = assertHttpUrl(flags['studio-url'], '--studio-url');
  const portalStore = await createPortalStore({
    postgresUrl: flags['portal-database-url'] || process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL || ''
  });

  let settings = null;
  try {
    await portalStore.ensureSiteRecords(normalizedSlug);
    settings = await portalStore.patchSiteSettings(normalizedSlug, { studioUrl });
  } finally {
    await portalStore.close();
  }

  const envPath = resolveSiteEnvPath(normalizedSlug);
  const env = parseEnvFile(envPath);
  env.SANITY_STUDIO_URL = studioUrl;
  fs.writeFileSync(envPath, serializeEnv(env), 'utf8');

  const registry = loadRegistry();
  const currentSite = Array.isArray(registry.sites)
    ? registry.sites.find((site) => sanitizeSiteSlug(site.siteSlug) === normalizedSlug)
    : null;
  const nextSite = {
    ...(currentSite || {}),
    siteSlug: normalizedSlug,
    studioUrl,
    updatedAt: new Date().toISOString()
  };
  const nextSites = Array.isArray(registry.sites) ? [...registry.sites] : [];
  const siteIndex = nextSites.findIndex((site) => sanitizeSiteSlug(site.siteSlug) === normalizedSlug);
  if (siteIndex >= 0) nextSites[siteIndex] = nextSite;
  else nextSites.push(nextSite);
  saveRegistry({ ...registry, sites: nextSites });

  console.log(
    JSON.stringify(
      {
        ok: true,
        siteSlug: normalizedSlug,
        studioUrl,
        runtimeEnvPath: displayPath(WORKSPACE_ROOT, envPath),
        registryPath: displayPath(WORKSPACE_ROOT, SITE_REGISTRY_PATH),
        portalSettings: {
          studioUrl: settings?.studioUrl || studioUrl
        }
      },
      null,
      2
    )
  );
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
      case 'set-studio-url':
        await commandSetStudioUrl(positional[0], flags);
        break;
      case 'handoff-site':
        await commandHandoffSite(positional[0], flags);
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
