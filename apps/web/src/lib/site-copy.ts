import { getActiveSiteBlueprint, siteConfig } from './site';

type AboutCardCopy = {
  title: string;
  text: string;
};

export type SiteCopy = {
  home: {
    clustersEyebrow: string;
    clustersTitle: string;
    clustersDescription: string;
    latestEyebrow: string;
    latestTitle: string;
    carouselEyebrow: string;
    carouselTitle: string;
    moreStoriesEyebrow: string;
    moreStoriesTitle: string;
    noteEyebrow: string;
    noteTitle: string;
    noteDescription: string;
    metricPrimaryLabel: string;
    metricSecondaryLabel: string;
  };
  about: {
    metadataDescription: string;
    heroEyebrow: string;
    heroTitle: string;
    heroDescription: string;
    cards: AboutCardCopy[];
  };
  magazineHeroEmpty: {
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel: string;
  };
  footer: {
    defaultDescription: string;
    editorialDescription: string;
    technicalDescription: string;
    wellnessDescription: string;
  };
  category: {
    emptyTitle: string;
    emptyDescription: string;
  };
  privacy: {
    metadataDescription: string;
  };
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) return base;

  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }

  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override ?? base) as T;
  }

  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    if (value === undefined) continue;
    if (isPlainObject(current) && isPlainObject(value)) {
      out[key] = mergeDeep(current, value);
      continue;
    }
    out[key] = value;
  }

  return out as T;
}

function buildDefaultCopy(): SiteCopy {
  const niche = siteConfig.niche;
  const name = siteConfig.name;

  return {
    home: {
      clustersEyebrow: 'Explore by topic',
      clustersTitle: `${niche} ideas for everyday life`,
      clustersDescription:
        'Pick a category to find practical guides, clear steps, and inspiration you can apply right away.',
      latestEyebrow: 'Latest',
      latestTitle: 'Recently published guides',
      carouselEyebrow: 'Highlights',
      carouselTitle: 'Reader favorites',
      moreStoriesEyebrow: 'More to explore',
      moreStoriesTitle: 'More stories you may like',
      noteEyebrow: 'Start here',
      noteTitle: 'Find guides that match your routine',
      noteDescription:
        'Pick one category, start with practical basics, and build from there with new ideas you can apply week after week.',
      metricPrimaryLabel: 'Curated categories',
      metricSecondaryLabel: 'Published guides'
    },
    about: {
      metadataDescription: `Learn what ${name} offers and how to use it to find practical ${niche} inspiration.`,
      heroEyebrow: 'About',
      heroTitle: `About ${name}`,
      heroDescription:
        `Discover practical ${niche} ideas, easy-to-follow guidance, and curated inspiration designed for real everyday use.`,
      cards: [
        {
          title: 'What you will find',
          text: 'Step-by-step articles, practical checklists, and curated ideas focused on useful outcomes rather than theory.'
        },
        {
          title: 'How to use this site',
          text: 'Browse categories, start with beginner guides, and move to deeper topics at your own pace.'
        },
        {
          title: 'Editorial approach',
          text: 'We prioritize clarity, safety, and actionable advice to help you apply ideas quickly and confidently.'
        }
      ]
    },
    magazineHeroEmpty: {
      eyebrow: 'Welcome',
      title: `${niche} inspiration, curated for everyday life`,
      description:
        'Explore practical ideas, clear tutorials, and useful tips tailored to this topic. New guides appear here regularly.',
      ctaLabel: 'Browse categories'
    },
    footer: {
      defaultDescription:
        `Curated ${niche} stories and practical ideas designed to be useful, readable, and easy to apply.`,
      editorialDescription:
        `A curated magazine for elegant ${niche} inspiration, practical ideas, and timeless routines.`,
      technicalDescription:
        `Clear, practical ${niche} guides with structured navigation so you can find what you need quickly.`,
      wellnessDescription:
        'Gentle, practical beauty and wellness guidance designed for consistent routines and measurable progress.'
    },
    category: {
      emptyTitle: 'No guides in this category yet',
      emptyDescription: 'Check back soon or browse other categories for fresh articles and practical ideas.'
    },
    privacy: {
      metadataDescription: `Privacy policy for ${name}.`
    }
  };
}

const blueprint = getActiveSiteBlueprint() as { uiCopy?: DeepPartial<SiteCopy> } | null;
const defaultCopy = buildDefaultCopy();
const siteCopy = mergeDeep(defaultCopy, blueprint?.uiCopy);

export function getSiteCopy() {
  return siteCopy;
}
