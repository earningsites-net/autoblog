#!/usr/bin/env node

/**
 * Demo utility for local QA scoring thresholds used by the n8n pipeline.
 * Usage: node scripts/qa-score-demo.mjs <json-file>
 */

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/qa-score-demo.mjs <article-draft.json>');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
const article = JSON.parse(raw);

const bodyText = Array.isArray(article.body)
  ? article.body.flatMap((b) => b.children || []).map((c) => c.text || '').join(' ')
  : '';
const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
let score = 100;
const flags = [];

if (wordCount < 700) {
  score -= 25;
  flags.push('body_too_short');
}
if (!article.seoTitle || article.seoTitle.length < 35 || article.seoTitle.length > 70) {
  score -= 8;
  flags.push('seo_title_length');
}
if (!article.seoDescription || article.seoDescription.length < 90 || article.seoDescription.length > 170) {
  score -= 8;
  flags.push('seo_description_length');
}
if (!article.coverImage || !article.coverImageAlt) {
  score -= 20;
  flags.push('image_missing');
}

console.log(JSON.stringify({ score: Math.max(0, score), flags, wordCount }, null, 2));
