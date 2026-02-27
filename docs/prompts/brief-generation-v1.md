# Brief Generation Prompt v1

## Goal
Turn a topic candidate into a structured editorial brief for an EN-US Home & DIY article.

## Required Output
JSON with:
- `angle`
- `audience`
- `outline` (H2/H3 hierarchy)
- `entities`
- `faqIdeas`
- `internalLinkIntent` (which existing categories/articles to reference)

## Constraints
- Informational only
- No risky claims
- Practical, beginner-safe framing
