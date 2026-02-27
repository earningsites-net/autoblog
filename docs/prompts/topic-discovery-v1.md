# Topic Discovery Prompt v1

## Goal
Generate evergreen Home & DIY informational topic candidates that are ad-safe, non-YMYL, and suitable for medium-depth articles.

## Constraints
- Exclude medical, legal, financial, electrical, structural, and advanced plumbing guidance.
- Prefer practical, seasonal, beginner-friendly topics.
- Return JSON only.

## Output Schema (conceptual)
- `query`
- `targetKeyword`
- `supportingKeywords[]`
- `evergreenScore` (0-100)
- `riskScore` (0-100)
- `templateType` (`how-to|list|tips|checklist`)
- `searchIntent` (`informational`)
