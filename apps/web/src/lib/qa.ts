import type { Article, QAResult } from './types';

const BANNED_PATTERNS = [
  /guarantee/i,
  /cure/i,
  /instant results/i,
  /licensed electrician/i,
  /structural repair/i
];

export function scoreArticleDraft(
  article: Pick<
    Article,
    'title' | 'excerpt' | 'body' | 'seoTitle' | 'seoDescription' | 'coverImage' | 'coverImageAlt'
  >
): QAResult {
  const flags: string[] = [];
  let score = 100;

  const bodyText = article.body.flatMap((b) => b.children).map((c) => c.text).join(' ');
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  if (wordCount < 700) {
    flags.push('body_too_short');
    score -= 25;
  }
  if (wordCount > 1800) {
    flags.push('body_too_long');
    score -= 10;
  }
  if (!article.seoTitle || article.seoTitle.length < 35 || article.seoTitle.length > 70) {
    flags.push('seo_title_length');
    score -= 8;
  }
  if (!article.seoDescription || article.seoDescription.length < 90 || article.seoDescription.length > 170) {
    flags.push('seo_description_length');
    score -= 8;
  }
  if (!article.coverImage || !article.coverImageAlt) {
    flags.push('image_missing');
    score -= 20;
  }
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(`${article.title} ${article.excerpt} ${bodyText}`)) {
      flags.push('risky_claim_language');
      score -= 30;
      break;
    }
  }

  return { score: Math.max(0, score), flags };
}
