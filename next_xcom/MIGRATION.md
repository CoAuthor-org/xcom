# Migration: Express → Next.js

Full migration complete. All files moved into `next_xcom`.

## Running the app

From `next_xcom`:

```bash
cd next_xcom
npm install
npm run dev
```

Then open **http://localhost:3000** — you'll be redirected to `/index.html` (the existing UI).

## Environment

- `.env` must be in `next_xcom/` (copy from root or create there).

## API routes (rewritten from Express)

| Path | Method | Purpose |
|------|--------|---------|
| `/entries` | GET | List saved entries |
| `/entries/:id` | PUT, DELETE | Update or delete entry |
| `/entries/:id/queue` | PATCH | Set queue (10am/6pm) |
| `/entries/:id/image` | POST, DELETE | Attach/remove image |
| `/entries/all` | DELETE | Delete all entries |
| `/save` | POST | Save new entry |
| `/generate` | POST | LLM generate/enhance |
| `/llm/status` | GET | LLM status |
| `/api/storage-status` | GET | Supabase status |
| `/notes/files` | GET | List note files |
| `/notes/content` | GET | Get note content |
| `/notes/progress/reset` | POST | Reset progress pointer |
| `/generate-from-notes` | POST | Start RAG job |
| `/generate-from-notes/status/:jobId` | GET | Poll job status |

## Cron

The cron job (`cron/post-next.js`) is unchanged and still runs from the root:

```bash
npm run cron:post
```

## Next steps (Phase 2)

- Replace `index.html` with React components
- Migrate styles to Tailwind CSS
- Optionally move cron into an API route for serverless deployment
