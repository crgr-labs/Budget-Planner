# Moving from Google Sheets to a free database (decision note)

Status: **not decided.** The app works as it is. This note collects the options so the decision can be made later.
Free-tier limits below are from early 2026 and change often. Check the provider's pricing page before committing.

## Why consider it at all

The current setup (a Google Apps Script writing to a Google Sheet) has three structural weaknesses:

1. **Whole-ledger overwrite.** Every save sends the entire ledger (`action: 'replace'`). Anything the script does not know about is silently dropped. This is why the `pending` status was lost on refresh.
2. **Last write wins.** If two devices edit around the same time, the later save replaces the earlier one. There is no per-row history or conflict handling.
3. **Exposed URL.** The Apps Script URL is baked into the built JavaScript by `.github/workflows/deploy.yml`. If the GitHub Pages site is public, anyone who finds the URL can read or overwrite the ledger.

## What is already mitigated (so there is no urgency)

- Uploads are blocked until the cloud copy has loaded successfully on that device.
- Hosted mode shows a loading / "couldn't load" screen instead of allowing edits that could overwrite the cloud.
- A tab you return to quietly refreshes from the cloud when nothing is waiting to save.
- A save that is still waiting is sent when the tab is hidden or closed.

What is **not** solved without a database: two devices editing at the same time, and the exposed URL.

## Options

| Option | Free tier (early 2026) | Notes |
| --- | --- | --- |
| **Supabase** (Postgres) | 500 MB, built-in login, row-level security | Best fit for an online-first app. Free projects pause after about a week of inactivity and must be restored manually. |
| **Firebase Firestore** | Spark plan: 1 GiB, about 50k reads and 20k writes per day, no card | Built-in offline mode that syncs per document. Free project does not pause. |
| **Cloudflare D1 + Worker** | 5 GB | Free and solid, but you write and host the API yourself. |
| **Neon / Turso / MongoDB Atlas** | Free tiers exist | You also need your own API and login layer. |

The ledger is tiny (a few thousand rows a year), so size limits will not matter for any of them.

## The key question: do you need offline entry?

The cache on your device is only safe if it is treated as read-only. Rules that must hold with any database:

- Never write before this device has loaded the current data.
- Write single rows (add / edit / delete), never the whole ledger.
- The device cache is only for instant display. The server's answer always replaces it and it is never uploaded.
- If offline entry is needed, queue the actions ("added X", "cleared Y") and replay them after loading fresh data. Do not upload a snapshot of the device's state.

Which means:

- **Online only** (you usually have signal): **Supabase**. Simplest and safest.
- **Need to log purchases without signal:** **Firestore**. Its offline mode already handles the queue and replay.

## Migration path (if you go ahead)

1. **Back up first.** Save the JSON from your sync URL or use the dashboard's CSV export.
2. **Create the database.** One `transactions` table (`user_id`, `date`, `description`, `category`, `subcategory`, `type`, `amount`, `savings`, `fund_type`, `account`, `status`). Keep categories, bills and plan settings as one JSON row per user. Turn on row-level security so each user only sees their own rows.
3. **Set up login** for your own account (magic link or email), then disable public sign-ups.
4. **Import once** with a local script. The service key stays on your machine, never in the repo.
5. **Change the app.** Replace `loadFromApi` and `executeSyncToApi` with a small data service that writes single rows. Do this as its own change so the backend can be swapped without touching the UI.
6. **Cut over.** Run both for a short while, then switch. Keep the Google Sheet as a read-only backup.

## Cheaper alternative

Stay on Google Sheets and just fix the Apps Script (add a `status` column). This solves the pending problem but not the exposed URL or two-device conflicts.

## Decisions needed

- Do you need to enter transactions without internet? (Firestore vs Supabase)
- Is the GitHub Pages site public? (decides how much the exposed URL matters)
- Will more than one person use the app? (matters for login and row-level rules)
- Should the Google Sheet stay as a backup after moving?
