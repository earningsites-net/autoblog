# Article Generation Prompt v1

## Goal
Generate a publishable medium-depth article (900-1400 words) from a validated brief.

## Required Output (JSON)
- `title`
- `slug`
- `excerpt`
- `body` (portable-text-like blocks)
- `faqItems`
- `seoTitle`
- `seoDescription`
- `disclaimerVariant` (`general|safety`)

## Constraints
- EN-US
- Informational tone
- No brand endorsements unless explicitly allowed
- No electrical/structural/plumbing advanced instructions
- Avoid keyword stuffing
