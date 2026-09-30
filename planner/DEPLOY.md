# Weekly Planner — production link

The planner app lives in **`planner/`** and deploys as the Vercel project **`weeklyplanner`**.

## Single production URL (use this only)

**https://book-archive-journal-8l2v.vercel.app**

Bookmark this link for diary, weekly planner, mailbox, relations, expenses, and compass. All feature work ships on the **`main`** branch to this deployment.

Alternate alias (same build): https://weeklyplanner-jieun1108.vercel.app

## Not the Reading Archive app

| App | Folder | Vercel project | URL |
|-----|--------|----------------|-----|
| **Weekly Planner** | `planner/` | **weeklyplanner** | URLs above |
| **Reading Archive** (books) | repo root | **book-archive-journal** | https://book-archive-journal.vercel.app |

If the window says **Reading Archive** or **Loading your library…**, you opened the wrong app. Planner data is only on the weeklyplanner URLs.

## Mac Dock / PWA

Install shortcuts from **https://book-archive-journal-8l2v.vercel.app** only. After a deploy, hard refresh (`Cmd+Shift+R`) once so the tab is not stuck on an old bundle.

## Vercel settings

- **weeklyplanner** → Root Directory: `planner`, production branch: **`main`**
- **book-archive-journal** → Root Directory: `.` (repository root)

## Data safety (no accidental loss)

- **Diary:** Cloud rows and images are in Supabase (`planner.diary_entries`, bucket `diary-media`). Autosave does **not** delete cloud diary rows; only an explicit delete in the UI does. If metadata is missing but photos remain in Storage, run `planner.repair_diary_entries_from_storage(user_id)` (see `planner/supabase/migrations/20260921_diary_repair_from_storage.sql`).
- **Tasks / weekly log:** Local browser cache is merged with Supabase on load and sync so completions are not wiped by empty cloud snapshots.
- **Wishlist photos:** Stored locally (IndexedDB); cloud holds metadata. Restores prefer snapshots that still have photos.
- **Mailbox:** Creates, deletes, and edits sync bidirectionally when signed in; use the same account and production URL on each device.

Your data stays in **this browser profile** on **this exact website address** (including the subdomain) plus your Supabase account when signed in.

**If diary days disappear after opening a “new” link:** `weeklyplanner-jieun1108.vercel.app` and `book-archive-journal-8l2v.vercel.app` are different browser storage buckets. Open the **old bookmark once**, wait on the Diary tab so notes upload to Supabase, then use the single production URL above and tap **Retry sync** on Diary.

**September 2026 text (9/7–9/20):** Supabase still has photos for those days, but title/body were overwritten on 2026-09-20 by a bad sync. **Vercel rollbacks cannot restore that text** (data lives in Supabase, not the deploy). What still works:

1. On Diary, tap **기록 복구** — reloads the month from Supabase and pushes any longer text from **this browser’s** IndexedDB.
2. If the text exists on another device or an old bookmark URL, open that URL, stay on Diary until sync finishes, then use **기록 복구** on the production URL.
3. Supabase **9/1–9/6** (and **9/6** body) are intact in the database; after deploy + hard refresh they should appear again once local cache is refreshed.

**9/5** has no row in Supabase today — recover only from a browser that still has that day locally.
