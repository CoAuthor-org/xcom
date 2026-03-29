# Scouter Module Setup

Scouter is implemented as an isolated module:

- UI: `components/scouter/*` (mounted from sidebar as `Scouter`)
- APIs: `app/api/scouter/*`
- Services: `lib/scouter/*`
- Schema: `migrations/009_scouter_foundation.sql`
- Worker: `scripts/night_watcher.py`

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`)
- `XAI_API_KEY` (or `GROK_API_KEY`)

## Optional Environment Variables

- `SCOUTER_GROK_MODEL` (default: `grok-3-mini`)
- `SCOUTER_EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- `SCOUTER_WEBHOOK_SECRET` (`x-scouter-secret` header for email webhook)
- `SCOUTER_CRON_SECRET` (or reuse `CRON_SECRET` for cron endpoints)
- `SCOUTER_GITHUB_TOKEN` (or `GITHUB_TOKEN` / `GITHUB_ACCESS_TOKEN`)
- `SCOUTER_LEAD_FEEDS` (comma-separated RSS URLs)
- `SCOUTER_WHISPER_MODEL` (night watcher, default: `base`)
- `SCOUTER_NIGHT_WATCHER_POLL_SEC` (night watcher polling interval)

## Migration

Run SQL in Supabase SQL Editor:

- `migrations/009_scouter_foundation.sql`

This migration is additive and does not modify existing non-Scouter tables.

## Main Endpoints

- `GET /api/scouter/metrics`
- `POST /api/scouter/webhooks/email`
- `GET /api/scouter/knowledge`
- `GET /api/scouter/knowledge/:id/drafts`
- `PATCH /api/scouter/drafts/:id`
- `GET /api/scouter/cron/leads`
- `GET /api/scouter/opportunities`
- `PATCH /api/scouter/opportunities/:id`
- `GET /api/scouter/opportunities/export`
- `GET /api/scouter/cron/github`
- `GET /api/scouter/os-repos`
- `POST /api/scouter/os-repos/:id/initialize`
- `GET /api/scouter/youtube`
- `POST /api/scouter/youtube`
- `GET /api/scouter/knowledge/search`

## Night Watcher Worker

Install prerequisites:

- `yt-dlp`
- `whisper` CLI
- Python package: `requests`

Run worker:

```bash
python scripts/night_watcher.py
```
