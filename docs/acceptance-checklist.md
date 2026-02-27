# MVP Acceptance Checklist

- Home page renders with zero-content fallback and with content cards.
- Dynamic article page outputs JSON-LD (`Article`, `BreadcrumbList`, optional `FAQPage`).
- Category pages support pagination via `?page=`.
- `robots.txt` and `sitemap.xml` resolve.
- `/api/revalidate` rejects unauthorized requests and accepts valid payloads.
- Frontend excludes non-published articles.
- Sanity schema includes all required document types.
- n8n templates exist for 7 planned workflows.
- Budget mode thresholds documented and implemented in templates/scripts.
- Handoff docs and credential checklist included.
