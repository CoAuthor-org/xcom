# Cron: scheduled posting to X

This folder and the GitHub Action run the **scheduler** for your content pipeline. There are **four queues**: **8am**, **12pm**, **4pm**, and **8pm** (IST). Each run posts the next entry from the matching queue and marks it as posted.

## How it works

- **Four queues**: Each entry has a `queue` column: `'8am'`, `'12pm'`, `'4pm'`, or `'8pm'` (or null = not scheduled). In the app you assign a queue per entry.
- **Runs**: At **8:00**, **12:00**, **4:00**, and **8:00 PM IST** the job picks the oldest entry/thread with the matching queue and `posted_at IS NULL`, posts it to X, and sets `posted_at`.
- **Schedule**: Four separate workflows, each with a 1–1.5h buffer to absorb GitHub Actions delay:
  - `cron-post-8am.yml`: 01:00 UTC = 6:30am IST (posts 8am queue)
  - `cron-post-12pm.yml`: 05:30 UTC = 11:00am IST (posts 12pm queue)
  - `cron-post-4pm.yml`: 09:30 UTC = 3:00pm IST (posts 4pm queue)
  - `cron-post-8pm.yml`: 13:30 UTC = 7:00pm IST (posts 8pm queue)
- **Manual run**: Actions → Cron post next tweet (manual) → choose queue and Run workflow.

## Prerequisites

1. **Supabase**: Migrations `003_entries_posted_at.sql` and `006_entries_queue_four_times.sql` (for 8am/12pm/4pm/8pm queues) must be applied.
2. **X (Twitter) Developer account**: Create an app in the [X Developer Portal](https://developer.x.com/) and obtain OAuth 1.0a credentials for **user context** (posting on behalf of your account).

## Environment variables

Used by `post-next.js` (and by the GitHub Action via repository secrets):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `X_API_KEY` | X OAuth 1.0a **Consumer Key** (API Key) from your app |
| `X_API_SECRET` | X OAuth 1.0a **Consumer Secret** (API Secret) |
| `X_ACCESS_TOKEN` | User **Access Token** (from “Keys and tokens” after authorizing the app) |
| `X_ACCESS_TOKEN_SECRET` | User **Access Token Secret** |

For **local runs**, set these in the project root `.env`. For **GitHub Actions**, add them as **Secrets** (Settings → Secrets and variables → Actions):  
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.

## Run locally

From the project root:

```bash
npm run cron:post
```

Or:

```bash
node cron/post-next.js
```

- If there is no queued entry, the script exits 0 and logs “No queued entries to post.”
- If posting or DB update fails, it exits with a non-zero code.

## Design (best-practice scheduling)

- **Four queues (8am, 12pm, 4pm, 8pm IST)**: Lets you spread content across the day; each run only reads from the matching queue.
- **Queue = stack by `created_at`**: Within each queue, order is oldest first so the same entry is not skipped or duplicated.
- **Mark as posted, don’t delete**: Keeps history in Supabase and lets you show “posted at” in the UI or re-use content later.

Together with notes → tweets generation and the main app, this gives you a single pipeline: raw notes → generated tweets in Supabase → automatic posting on a fixed schedule.

---

## X Engager (reply discovery) — Vercel Cron

The **X Engager** UI uses separate tables (`search_queries`, `pending_replies`). Scheduled **discovery** (search X + Grok drafts) can run on **Vercel** via [`vercel.json`](../vercel.json):

- **08:00 IST** → cron hits `GET /api/discover-posts?batch=morning` at **02:30 UTC**
- **18:00 IST** → `GET /api/discover-posts?batch=evening` at **12:30 UTC**

Set in the Vercel project:

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Random secret; Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron invocations |
| `XAI_API_KEY` or `GROK_API_KEY` | xAI Grok API key for reply generation |
| `X_BEARER_TOKEN` *or* same OAuth vars as above | X API v2 **recent search** (bearer **or** user-context OAuth 1.0a) |
| `X_OWN_USERNAME` | Optional: your handle without `@`; appended as `-from:user` to exclude your posts |
| `X_ENGAGER_BRAND_NAME`, `X_ENGAGER_TONE` | Optional Grok persona |

Apply migration [`migrations/008_reply_automation.sql`](../migrations/008_reply_automation.sql) in Supabase. Discovery **does not** post tweets; it only inserts rows for you to copy from the app.

---

## X Engager inbound (@mentions) — GitHub Actions (recommended)

**Inbound** replies use `GET /2/users/:id/mentions` and require **OAuth 1.0a user context** on the server (same `X_API_KEY` / `X_ACCESS_TOKEN` vars as posting). Bearer-only search tokens **cannot** poll mentions.

1. Apply migration [`migrations/012_inbound_engager.sql`](../migrations/012_inbound_engager.sql) in Supabase (extends `reply_automation_meta` with `last_mentions_since_id`, etc.).
2. Cron route: `POST` or `GET` `/api/cron/poll-mentions` — same `CRON_SECRET` auth as discover (`Authorization: Bearer …` or `?secret=`).
3. Optional env on the server:
   - **`X_USER_ID`**: Your numeric X user id (if omitted, the app calls `v2.me()` once and caches id in `reply_automation_meta.cached_x_user_id`).
   - **`X_ENGAGER_INBOUND_CONVERSATION_SEARCH`**: set to `1` / `true` to run an extra recent search per mention for thread summary (uses search quota).

**Scheduling:** [`../../.github/workflows/cron-poll-x-mentions.yml`](../../.github/workflows/cron-poll-x-mentions.yml) calls your deployed app every 15 minutes. Add repository secrets:

| Secret | Description |
|--------|-------------|
| `APP_BASE_URL` **or** `SITE_URL` | **Required.** Your live site origin (e.g. `https://your-app.vercel.app`), no trailing slash. GitHub’s runner is not your server — it needs this URL to know where to `curl`. This is independent of `CRON_SECRET`. |
| `CRON_SECRET` | Must match the Vercel/server `CRON_SECRET`. Sent as `Authorization: Bearer …` so `/api/cron/poll-mentions` accepts the request. |

The **Inbound** tab in X Engager lists `inbound_reply_queue` rows; **Post reply** uses `POST /2/tweets` with `reply.in_reply_to_tweet_id` set to the mention tweet id.

If you use **Vercel Pro** and prefer hosting the schedule there, add another entry in `vercel.json` pointing at `/api/cron/poll-mentions` instead of (or in addition to) this workflow.
