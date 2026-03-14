# Cron: scheduled posting to X

This folder and the GitHub Action run the **scheduler** for your content pipeline. There are **two queues**: **10am** and **6pm** (IST). Each run posts the next entry from the matching queue and marks it as posted.

## How it works

- **Two queues**: Each entry has a `queue` column: `'10am'` or `'6pm'` (or null = not scheduled). In the app you assign a queue per entry (10am or 6pm).
- **10am run**: At **10:00 IST** the job picks the oldest entry with `queue = '10am'` and `posted_at IS NULL`, posts it to X, and sets `posted_at`.
- **6pm run**: At **18:00 IST** it picks the oldest entry with `queue = '6pm'` and `posted_at IS NULL`, posts it, and sets `posted_at`.
- **Schedule**: GitHub Actions runs at **10:00 IST** and **18:00 IST** (04:30 UTC and 12:30 UTC; see `.github/workflows/cron-post.yml`). You can also trigger manually and optionally choose which queue to run (Actions → Cron post next tweet → Run workflow).

## Prerequisites

1. **Supabase**: Migration `003_entries_posted_at.sql` must be applied so the `entries` table has a `posted_at` column.
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

- **Two queues (10am and 6pm IST)**: Lets you separate content (e.g. OS at 10am, JS at 6pm); each run only reads from the matching queue.
- **Queue = stack by `created_at`**: Within each queue, order is oldest first so the same entry is not skipped or duplicated.
- **Mark as posted, don’t delete**: Keeps history in Supabase and lets you show “posted at” in the UI or re-use content later.

Together with notes → tweets generation and the main app, this gives you a single pipeline: raw notes → generated tweets in Supabase → automatic posting on a fixed schedule.
