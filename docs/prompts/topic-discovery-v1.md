# Topic Discovery Prompt v1

## Goal
Generate evergreen, ad-safe, non-YMYL informational topic candidates aligned with the site's editorial niche.

## Constraints
- Exclude medical, legal, financial, electrical, structural, and advanced plumbing guidance.
- Prefer useful, specific, publication-quality topics with clear reader value.
- Return JSON only.

## Output Schema (conceptual)
- `query`
- `targetKeyword`
- `supportingKeywords[]`
- `evergreenScore` (0-100)
- `riskScore` (0-100)
- `templateType` (`how-to|list|tips|checklist`)
- `searchIntent` (`informational`)
