# n8n Infrastructure (MVP)

This folder contains a low-cost self-hosted n8n + PostgreSQL setup and workflow templates for the AI autopublishing pipeline.

## Components
- `docker-compose.yml`: n8n + Postgres stack
- `.env.example`: deployment environment variables
- `workflows/*.json`: importable workflow templates (adapt credentials and node config)

## Deployment Notes
- Host on a low-cost VPS (Hetzner/Contabo class) with Docker + Compose.
- Put n8n behind HTTPS reverse proxy before production.
- Restrict the editor URL and use strong `N8N_ENCRYPTION_KEY`.
- Set API credentials for LLM/image providers and Sanity tokens in `.env`.
