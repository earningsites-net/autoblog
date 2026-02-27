# Deploy Plan for Hammer & Hearth

## 1. Provision provider resources
- Create Vercel project (web frontend)
- Create/prepare Sanity project and dataset
- Prepare n8n or engine runtime environment

## 2. Configure environment
- Generate env: `node scripts/autoblog.mjs provision-env hammer-hearth`
- Review file: `sites/hammer-hearth/.env.generated`

## 3. Seed CMS
- Generate CMS seed payload: `node scripts/autoblog.mjs seed-cms hammer-hearth`
- Apply payload via CMS API/CLI (Sanity mutate endpoint for Sanity targets)

## 4. Deploy app
- Set env vars in deployment target
- Deploy Next.js app (`apps/web`)
- Validate `robots.txt`, `sitemap.xml`, and `/api/revalidate`

## 5. Enable automation
- Import n8n workflow templates or point site to engine API
- Run a smoke pipeline (topic -> publish)

## 6. QA / Handoff prep
- Generate handoff pack: `node scripts/autoblog.mjs handoff-pack hammer-hearth`
- Fill legal/contact placeholders and provider credentials securely
