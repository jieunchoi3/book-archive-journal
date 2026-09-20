# Weekly Planner deploy (important)

This repo contains **two separate web apps**:

| App | Folder | Vercel project | Production URL |
|-----|--------|----------------|----------------|
| **Weekly Planner** (diary, mail, weekly, …) | `planner/` | **weeklyplanner** | https://weeklyplanner-jieun1108.vercel.app |
| **Reading Archive** (book library) | repo root | **book-archive-journal** | https://book-archive-journal.vercel.app |

## Mac Dock / PWA

Always install the Dock shortcut from **Weekly Planner** (`weeklyplanner-jieun1108.vercel.app`).

If the window title says **Reading Archive** or **Loading your library…**, you are on the wrong app — diary data lives only in Weekly Planner.

## Vercel settings

- **weeklyplanner** → Root Directory: `planner`
- **book-archive-journal** → Root Directory: `.` (repository root)

Do not point both projects at the same root folder.

## Diary data safety

- Cloud diary rows and images live in Supabase (`planner.diary_entries`, bucket `diary-media`).
- Autosave **never deletes** cloud diary rows; only an explicit delete in the UI removes cloud data.
- If rows are missing but photos remain in Storage, run `planner.repair_diary_entries_from_storage(user_id)` in Supabase SQL (see migration `20260921_diary_repair_from_storage.sql`).
