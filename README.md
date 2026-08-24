# AI Lean / Auction Photo Tracking & Analytics Dashboard

Centralized Admin Operations Dashboard for tracking the BOG photo-request
process for units heading to public auction, plus historical analytics and
AI-assisted root-cause analysis on tracking notes.

There is a single dashboard for Admin users. Managers, facilities, and
auction cycles are all handled through filters rather than separate
dashboards, per the product spec.

## Status: running on real July/August 2026 data

The dashboard is wired up to the actual July and August 2026 Site-Manager
tracking sheets (`src/data/raw-imported-rows.json`, 2,170 unit rows across
15 site managers and 192 facilities). `src/lib/mockData.ts` still exists as
a synthetic fallback dataset but is no longer imported by the app —
`src/app/page.tsx` reads from `src/lib/sheetsImport.ts`.

### Batch / deadline mapping

Auction batches and their photo-upload deadlines, as provided by Ops
(`BATCH_BY_DATE` in `src/lib/sheetsImport.ts`):

| Cycle | Auction date(s) | Deadline |
|---|---|---|
| July 2026 — Batch 1 | 7/15 | 7/6 |
| July 2026 — Batch 2 | 7/22, 7/28, 7/31 | 7/17 |
| August 2026 — Batch 1 | 8/17 | 8/6 |
| August 2026 — Batch 2 | 8/26 | 8/15 |

**Open question:** 18 units in the August sheet are dated 8/19, which wasn't
in the batch list provided. They're currently assumed to belong to Batch 1
(nearest date, same deadline) — flagged via `importWarnings` in
`sheetsImport.ts` and worth confirming.

### Data-quality caveat — read before trusting the headline numbers

The source sheets are **not** a complete photo-request log: only ~33% of
rows (706 of 2,170) have any photo-status or notes entry at all. The rest
are `Not Requested` — either because no request was ever logged, or because
that Site Manager's tab (e.g. Courtney, Luann) doesn't track this workflow
in the sheet at all. There's no way to tell those two cases apart from the
data alone.

To avoid a misleading headline, `Not Requested` units are **excluded** from
the Overdue / BOG-delay / Owner-delay / escalation KPIs and are capped at
"Medium" severity even when their deadline has long passed (see the
comments in `calculations.ts` and `analytics.ts`). The AI Insights tab
surfaces the excluded count explicitly as its own caveat insight rather
than hiding it. **Recommend confirming with Ops** whether a blank row means
"never requested" or "not tracked here" before treating that number as a
compliance gap.

### Known source-data gaps (not fabricated — left null instead)

The sheets have no dedicated columns for:
- **Photo request date** — recovered only when a date is written into the
  note text itself (e.g. "Requested on 6.24.26..."); otherwise `null`.
- **Photos received date** — same: recovered from note text when present
  (e.g. via the last "Followed up on ..." date), otherwise `null`.
- **Follow-up count** — recovered by counting "Followed up" mentions and
  embedded dates in the note text (`src/lib/noteTimeline.ts`); otherwise 0.

This means "Days Waiting" and "Avg Response Time" are best-effort and will
under-count units where the timeline wasn't spelled out in the note.

## Re-running the import for a new auction cycle

1. Export the new Google Sheet as `.xlsx`.
2. `pip install openpyxl` then:
   ```bash
   python3 scripts/extract_google_sheet.py "September 2026" september.xlsx > src/data/september-rows.json
   ```
3. Merge the new array into `src/data/raw-imported-rows.json` (or extend
   `sheetsImport.ts` to read multiple row files).
4. Add the new cycle's auction-date → deadline mapping to `BATCH_BY_DATE` in
   `src/lib/sheetsImport.ts`.
5. Bump `TODAY_ISO` in `sheetsImport.ts` if regenerating well after the
   original snapshot date — it's used to decide whether a deadline has
   passed for status categorization (the live countdown/overdue math in the
   UI itself always uses the real current date, this only affects how a
   historical row gets bucketed at import time).

`scripts/extract_google_sheet.py` deliberately excludes lock codes, gate
codes, key-access instructions, and tenant names from the import — they're
present in the source sheets but aren't part of the dashboard's data model
and shouldn't be duplicated into another system.

## What's implemented

- **Data model** (`src/lib/types.ts`) — unit, photo-request, delay
  responsibility, follow-up, and AI-analysis fields per the spec.
- **Import pipeline** (`src/lib/sheetsImport.ts`, `src/lib/noteTimeline.ts`,
  `scripts/extract_google_sheet.py`) — column-name standardization across
  15 differently-structured Site Manager tabs, batch/deadline resolution,
  request-status inference from photo-status tokens + note text, and
  date/follow-up-count extraction from free-text notes.
- **Calculations** (`src/lib/calculations.ts`) — days waiting, days
  overdue, deadline countdown, severity (Critical/High/Medium/Low/
  Completed), on-time/late, and the KPI roll-up.
- **Heuristic note classifier** (`src/lib/classifier.ts`) — a rule-based
  stand-in for an LLM classification step, tuned against the real note
  vocabulary in these sheets (which uses "BOG" and "owner" more narrowly
  than the original spec framing — see comments in the file). It never
  guesses BOG as the cause without textual support; ambiguous notes are
  flagged `Unknown` / `needsReview` instead of assumed. Swap the body of
  `classifyNote()` for a real LLM call when ready — the return shape stays
  the same, and the original note text is always preserved separately.
- **Cycle & facility analytics** (`src/lib/analytics.ts`) — per-cycle and
  per-facility rollups (on-time %, BOG/owner issue %, avg response time,
  escalation rate, etc.), used by the Auction Cycle Analytics and Facility &
  BOG Performance sections. The facility ranking requires a minimum of 3
  logged requests before a facility is eligible, to avoid a single BOG
  incident reading as a "100% BOG issue rate."
- **AI Insights** (`src/lib/insights.ts`) — data-backed insight generation
  (the no-tracking-data caveat above, BOG rate trend across cycles, which
  facilities drove the latest cycle's BOG delays, recurring multi-cycle BOG
  patterns, owner-vs-BOG disambiguation, escalation hotspots, ambiguous-note
  review queue).
- **Reports** (`src/lib/reports.ts`) — weekly operations summary (overall +
  by-manager breakdown + action items) and a monthly AI operations report
  (executive summary, root cause breakdown, facility analysis, trend,
  data-driven recommendations).
- **CSV export** (`src/lib/csvExport.ts`) — exports whatever is currently
  filtered on the dashboard.
- **Dashboard UI** (`src/app/page.tsx` + `src/components/`) — the six
  navigation sections from the spec (Overview, Current Auction Units,
  Auction Cycle Analytics, Facility & BOG Performance, AI Insights,
  Reports), a combinable global filter bar, and the severity color-coded
  units table.

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Known gaps / next steps

- No persistence layer yet — data is a static import baked in at build
  time, not a live sync. A real deployment needs a database (rows keyed by
  `sourceRowKey` for de-dup) and a scheduled Google Sheets import job
  instead of the manual `scripts/extract_google_sheet.py` step.
- No auth — this is a UI prototype; Admin-only access control needs to be
  added before this goes anywhere near production data.
- The note classifier is heuristic/keyword-based, not a real LLM call —
  intentionally, since no AI provider access was wired into this build. It's
  structured so swapping in a real model is a one-function change.
- Manual correction of AI classifications (per the spec's "Admins can
  correct AI classifications" requirement) now has a UI: the Responsible
  Party and AI Issue Category cells in the Current Auction Units table are
  editable dropdowns (`src/lib/overrides.ts`, wired into `UnitsTable.tsx`).
  A corrected cell gets a blue outline and the change flows into every KPI,
  cycle/facility rollup, and insight downstream, while the AI's original
  call and an audit trail (who/when) stay on `manualOverride`. There's still
  no backend, so corrections persist to the browser's `localStorage` rather
  than a database — swapping in a real API is a one-function change in
  `overrides.ts`.
- The Current Auction Units table renders all matching rows without
  pagination/virtualization — fine for ~2,000 rows, worth revisiting if the
  dataset grows much further.
