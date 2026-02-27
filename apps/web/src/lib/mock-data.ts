import type { Article, Category, Tag, TopicCandidate, TextBlock } from './types';
import { estimateReadingTime } from './site';
import { getSiteBlueprint } from './site-blueprint';

const blueprint = getSiteBlueprint();

const defaultCategories: Category[] = [
  {
    _id: 'cat-home-org',
    title: 'Home Organization',
    slug: 'home-organization',
    description: 'Decluttering systems, storage ideas, and realistic routines that keep spaces usable.',
    accent: 'rust'
  },
  {
    _id: 'cat-cleaning',
    title: 'Cleaning & Maintenance',
    slug: 'cleaning-maintenance',
    description: 'Simple upkeep guides, seasonal cleaning plans, and easy maintenance checklists.',
    accent: 'sage'
  },
  {
    _id: 'cat-garden',
    title: 'Garden Basics',
    slug: 'garden-basics',
    description: 'Beginner-friendly garden planning, small-space ideas, and seasonal plant care basics.',
    accent: 'sage'
  }
];

const categories: Category[] =
  blueprint?.categories?.length
    ? blueprint.categories.map((category, index) => ({
        _id: `cat-${category.slug || index}`,
        title: category.title,
        slug: category.slug,
        description: category.description,
        accent: category.accent === 'sage' ? 'sage' : 'rust'
      }))
    : defaultCategories;

function categoryBySlug(slug: string, fallbackIndex = 0): Category {
  return categories.find((category) => category.slug === slug) ?? categories[fallbackIndex] ?? defaultCategories[0]!;
}

const tags: Tag[] = [
  { _id: 'tag-small-spaces', title: 'Small Spaces', slug: 'small-spaces' },
  { _id: 'tag-checklists', title: 'Checklists', slug: 'checklists' },
  { _id: 'tag-seasonal', title: 'Seasonal', slug: 'seasonal' },
  { _id: 'tag-beginner', title: 'Beginner', slug: 'beginner' }
];

function blocks(sections: Array<{ heading: string; paragraphs: string[] }>): TextBlock[] {
  const result: TextBlock[] = [];
  for (const section of sections) {
    result.push({
      _key: `${section.heading}-h2`,
      _type: 'block',
      style: 'h2',
      children: [{ _key: `${section.heading}-span`, _type: 'span', text: section.heading }]
    });
    for (const paragraph of section.paragraphs) {
      result.push({
        _key: `${section.heading}-${paragraph.slice(0, 10)}`,
        _type: 'block',
        style: 'normal',
        children: [{ _key: `${section.heading}-p`, _type: 'span', text: paragraph }]
      });
    }
  }
  return result;
}

const baseArticles: Omit<Article, 'readTimeMinutes'>[] = [
  {
    _id: 'art-1',
    title: '12 Small Entryway Storage Ideas That Keep Clutter Under Control',
    slug: 'small-entryway-storage-ideas',
    excerpt:
      'A practical, renter-friendly plan for organizing shoes, bags, and daily essentials in a tiny entryway without making it look crowded.',
    coverImage:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Warm modern entryway with storage bench, hooks, and baskets',
    category: categoryBySlug('home-organization', 0),
    tags: [tags[0]!, tags[1]!, tags[3]!],
    body: blocks([
      {
        heading: 'Start With a Drop Zone, Not a Full Makeover',
        paragraphs: [
          'The biggest entryway problem is usually daily drop-off, not a lack of furniture. Start by defining a single surface or basket where keys, mail, and sunglasses land every day.',
          'When the drop zone is obvious and easy to reach, clutter spreads less because every item has a default home before it reaches the kitchen counter.'
        ]
      },
      {
        heading: 'Use Vertical Space for Everyday Items',
        paragraphs: [
          'Wall hooks and slim rails create storage without blocking walkways. Group hooks by category so coats, bags, and hats are easy to grab on busy mornings.',
          'If you share the home, label baskets or hooks during the first few weeks until the system becomes a habit.'
        ]
      },
      {
        heading: 'Choose Closed Storage for Visual Calm',
        paragraphs: [
          'A narrow storage bench or cabinet hides mismatched items and reduces visual noise. Prioritize pieces that store shoes or seasonal accessories below a seated surface.',
          'Closed storage is especially helpful if you want the home to feel tidy quickly before guests arrive.'
        ]
      }
    ]),
    faqItems: [
      {
        question: 'What is the best storage option for a very narrow entryway?',
        answer:
          'A wall-mounted hook rail plus a shallow shoe cabinet usually works best because it keeps the walking path clear while handling the most common items.'
      },
      {
        question: 'How many shoe pairs should stay in the entryway?',
        answer:
          'Keep only your current daily-use pairs in the entryway and store out-of-season shoes elsewhere to prevent overcrowding.'
      }
    ],
    seoTitle: '12 Small Entryway Storage Ideas for a Cleaner, Calmer Home',
    seoDescription:
      'Use these small entryway storage ideas to organize shoes, bags, and everyday clutter with simple, renter-friendly solutions.',
    publishedAt: '2026-02-22T10:00:00.000Z',
    status: 'published',
    qaScore: 91,
    qaFlags: [],
    internalLinks: [],
    disclaimerVariant: 'general'
  },
  {
    _id: 'art-2',
    title: 'A Simple Weekly Kitchen Reset Routine You Can Finish in 45 Minutes',
    slug: 'weekly-kitchen-reset-routine',
    excerpt:
      'Use this realistic weekly kitchen reset checklist to restore counters, sinks, and high-touch areas without spending your entire weekend cleaning.',
    coverImage:
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Clean bright kitchen with wood counters and open shelves',
    category: categoryBySlug('cleaning-maintenance', 1),
    tags: [tags[1]!, tags[2]!, tags[3]!],
    body: blocks([
      {
        heading: 'Set a 45-Minute Limit Before You Start',
        paragraphs: [
          'Short time limits reduce perfectionism and help you focus on high-impact tasks. Aim for clean and functional, not deep-cleaned and styled.',
          'If your kitchen is heavily used, split the reset into two short sessions instead of trying to complete everything at once.'
        ]
      },
      {
        heading: 'Reset Surfaces in an Order That Prevents Rework',
        paragraphs: [
          'Begin with trash and dishes, then clear counters, and wipe surfaces last. This order prevents you from cleaning the same area twice.',
          'Finish by refilling a few essentials such as dish soap, hand soap, and clean towels so the kitchen stays easier to maintain all week.'
        ]
      }
    ]),
    faqItems: [
      {
        question: 'Should I deep clean appliances every week?',
        answer:
          'No. Weekly resets should focus on visible surfaces and high-touch areas. Schedule deeper appliance cleaning monthly or seasonally.'
      }
    ],
    seoTitle: 'Weekly Kitchen Reset Routine (45-Minute Checklist)',
    seoDescription:
      'A realistic weekly kitchen reset routine with a step-by-step checklist to keep your kitchen clean and functional in under an hour.',
    publishedAt: '2026-02-21T14:15:00.000Z',
    status: 'published',
    qaScore: 88,
    qaFlags: ['minor_repetition'],
    internalLinks: [],
    disclaimerVariant: 'general'
  },
  {
    _id: 'art-3',
    title: 'Beginner-Friendly Raised Bed Layout Tips for Small Backyards',
    slug: 'raised-bed-layout-tips-small-backyards',
    excerpt:
      'Plan a simple raised bed garden layout that fits a small backyard, supports easy maintenance, and leaves room for walking paths and storage.',
    coverImage:
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Small backyard with raised garden beds and gravel paths',
    category: categoryBySlug('garden-basics', 2),
    tags: [tags[3]!, tags[2]!],
    body: blocks([
      {
        heading: 'Design for Access Before Plant Variety',
        paragraphs: [
          'A layout that is easy to reach and maintain usually performs better than one with too many plants packed into tight corners.',
          'Leave comfortable pathways so you can water, prune, and harvest without stepping in planting areas.'
        ]
      },
      {
        heading: 'Place Beds Where Daily Maintenance Feels Easy',
        paragraphs: [
          'Choose a location you can check quickly each day. Convenience improves consistency, especially for beginners learning watering and pruning routines.',
          'If possible, keep a small tool bin nearby so basic garden tasks do not require a trip back indoors.'
        ]
      }
    ]),
    faqItems: [
      {
        question: 'How wide should a raised bed be for beginners?',
        answer:
          'A width of about 3 to 4 feet is common because it lets you reach the center from both sides without stepping into the bed.'
      }
    ],
    seoTitle: 'Raised Bed Layout Tips for Small Backyards (Beginner Guide)',
    seoDescription:
      'Learn how to plan a beginner-friendly raised bed layout for a small backyard with practical spacing and access tips.',
    publishedAt: '2026-02-20T09:30:00.000Z',
    status: 'published',
    qaScore: 90,
    qaFlags: [],
    internalLinks: [],
    disclaimerVariant: 'safety'
  }
];

export const articles: Article[] = baseArticles.map((article) => {
  const wordCount = article.body
    .flatMap((block) => block.children)
    .map((child) => child.text)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    ...article,
    readTimeMinutes: estimateReadingTime(wordCount)
  };
});

for (const article of articles) {
  article.internalLinks = articles
    .filter((candidate) => candidate.slug !== article.slug)
    .slice(0, 2)
    .map((candidate) => ({ slug: candidate.slug, title: candidate.title }));
}

export const topicCandidates: TopicCandidate[] = [
  {
    _id: 'topic-1',
    query: blueprint?.seedTopics?.[0] || 'mudroom organization ideas for families',
    searchIntent: 'informational',
    evergreenScore: 83,
    riskScore: 12,
    templateType: 'list',
    status: 'queued',
    targetKeyword: 'mudroom organization ideas',
    supportingKeywords: ['family entryway storage', 'mudroom baskets', 'shoe storage mudroom']
  },
  {
    _id: 'topic-2',
    query: blueprint?.seedTopics?.[2] || 'spring patio cleanup checklist',
    searchIntent: 'informational',
    evergreenScore: 76,
    riskScore: 10,
    templateType: 'checklist',
    status: 'brief_ready',
    targetKeyword: 'spring patio cleanup checklist',
    supportingKeywords: ['patio cleaning routine', 'outdoor furniture cleanup', 'seasonal patio prep'],
    whyNow: 'Seasonal search interest lift before outdoor entertaining'
  }
];

export const mockCategories = categories;
export const mockTags = tags;
