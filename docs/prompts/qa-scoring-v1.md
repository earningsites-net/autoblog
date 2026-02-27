# QA Scoring Prompt/Rules v1

## Automated checks
- Word count range
- SEO title/meta presence and length
- Duplicate similarity (title/body)
- Banned/risky wording
- Readability threshold
- Image presence + alt text
- Category scope compliance

## Decisions
- `score >= 75`: publish
- `score < 75`: `rejected_auto`

## Logging
Write `qaLog` with:
- `score`
- `decision`
- `flags[]`
- check metrics (duplicate/readability/wordCount)
