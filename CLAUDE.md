# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TimeNodes — a weekly time-tracking webapp (Turkish UI). React + TypeScript + Vite frontend backed by Supabase (Postgres + Auth + Storage). Deployed to GitHub Pages at https://timenodes.app via `.github/workflows/deploy.yml` on every push to `main`.

## Commands

- `npm run dev` — start Vite dev server (port 5173)
- `npm run build` — type-check (`tsc`) then build for production (`dist/`)
- `npm run preview` — preview the production build
- `npx tsc --noEmit` — type-check only (no test suite exists in this repo)

## Architecture

### State & data flow
- `src/App.tsx` is the single top-level component owning almost all app state (session, current week, timers, todos, view routing). There is no router or global store — view switching is a `view` state variable (`"week" | "weeks" | "stats" | "profile"`) and `navigate()`.
- Data model types live in `src/types.ts`. Key shapes: `WeekData` (habits + per-cell `minutes`/`breaks`/`notes` keyed by `habitId`, plus `dayNotes`), `ActiveTimer` (a running/paused stopwatch or pomodoro for one habit+day cell), `TodoItem` (daily agenda entries, optionally linked to a habit).
- `src/db.ts` is the only module that talks to Supabase for app data (habits, entries, todos, pages, day notes, auth, profile/avatar). All reads/writes go through typed helper functions here — don't call `supabase.from(...)` directly from components.
- `src/storage.ts` holds pure date/week helpers (ISO week numbers, Monday-of-week, `addDays`, etc.) and localStorage persistence for `ActiveTimer[]` (timers are device-local, keyed per user — `timenodes.timers.<userId>`).
- `src/timer.ts` is pure timer math (no I/O): computing elapsed work/break ms, phase progress, alarm-ringing state, `settle()` to fold a live segment into accumulated `workMs`/`breakMs`.

### Persistence pattern (important)
- `App.tsx` keeps the "current week" (`week`) and optionally a "viewed week" (`viewedWeek`, when browsing history from the Weeks page) as full `WeekData` objects in state.
- All edits go through `applyWeek(newWeek)`, which diffs `oldWeek` vs `newWeek` and calls `persist()`. `persist()` queues an async job on a `chain` ref (a promise chain) so DB writes happen strictly in order and don't race — diffs cover added/removed/reordered habits, changed cell minutes/breaks/notes, and changed day notes.
- Timers (`ActiveTimer[]`) are NOT persisted to Supabase — only to localStorage, since they represent a live in-progress session on this device. When a timer finishes (`finishTimer`), its accumulated minutes are folded into `week.minutes`/`week.breaks` and persisted via `applyWeek`.
- A 20s interval in `App.tsx` auto-finishes timers that exceed an 8-hour cap and reloads the page on day rollover (deferred while a modal/note page is open via `reloadBlockedRef`).

### Components (`src/components/`)
- `WeekGrid.tsx` — the main weekly table (habits × 7 days), drag-to-reorder habits, opens `CellPopover` for a cell.
- `CellPopover` / `MultiTaskModal` — per-cell timer controls and the "another timer is running" conflict dialog.
- `DayPanel.tsx` — left-side "today" panel: agenda/todos, quick-start habits.
- `WeeksPage.tsx` / `Stats.tsx` — yearly heatmap and stats, driven by `loadYearTotals`/`loadYearStats` from `db.ts`.
- `note/NotePage.tsx`, `note/NoteEditor.tsx`, `note/SlashCommand.ts` — Notion-style per-day notebook using Tiptap (stored as JSON in the `pages` table via `loadDayPage`/`saveDayPage`).
- `Login.tsx` — email/password auth (sign up requires display name; password policy: min 8 chars, letters + digits).
- `Profile.tsx` — display name, password change, avatar upload (Supabase Storage `avatars` bucket), friend code (unique UID).
- `theme.ts` — theme palette definitions, applied via `data-theme` attribute on `<html>` and persisted to localStorage (`tn-theme`).

### Supabase
- Client is created in `src/supabase.ts` with a hardcoded fallback URL/publishable key (overridable via `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`). The publishable key is safe to expose; data access is enforced by RLS policies.
- Schema migrations are plain SQL files in `supabase/migrations/`, applied in numeric order. Every user-data table has RLS enabled with `user_id = auth.uid()` (or equivalent) policies — when adding a new table, follow this pattern and add a migration file rather than altering existing ones.
- New users get default habits seeded automatically (`seedDefaultHabits` in `db.ts`, list in `DEFAULT_HABITS`) and a `profiles` row + unique `friend_code` via DB trigger (see `0007_email_auth_friendcode.sql`).

## Working Rules

- Respond in Turkish unless requested otherwise.
- Make the smallest possible change to complete the task.
- Do not perform large refactors unless explicitly requested.
- Only inspect files directly relevant to the task.
- Do not scan the entire repository unless necessary.
- Before modifying code, explain which files need changes.
- Prefer editing existing code over rewriting files.
- Ask for confirmation before making architecture changes.
- Keep solutions simple and practical.

## Coding Style

- Follow existing project conventions.
- Reuse existing components when possible.
- Avoid duplicate code.
- Keep functions focused and small.
- If the task is small, do not perform a full codebase analysis.

## Conventions
- Code comments and UI strings are in Turkish; keep new comments/strings consistent with this.
- IDs for new habits/entities are generated client-side with `crypto.randomUUID()` (`storage.ts: newId`) to match Postgres `uuid` columns.
- Day-of-week indexing is `0..6` for Monday..Sunday (ISO), distinct from JS `Date.getDay()` (`0..6` Sunday..Saturday) — conversions like `(d.getDay() + 6) % 7` appear where these meet.
