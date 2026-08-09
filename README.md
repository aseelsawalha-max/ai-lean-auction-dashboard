# AI Lean / Auction Photo Tracking & Analytics Dashboard

Centralized Admin Operations Dashboard for tracking the BOG photo-request
process for units heading to public auction, plus historical analytics and
AI-assisted root-cause analysis on tracking notes.

There is a single dashboard for Admin users. Managers, facilities, and
auction cycles are all handled through filters rather than separate
dashboards, per the product spec.

## Status: functional prototype on sample data

This build was generated automatically from the product spec, without the
actual Google Sheets exports or the photo-upload deadline rule attached to
the run. Everything below is real, working code — but it currently runs on
a **generated sample dataset** (`src/lib/mockData.ts`) designed to exercise
every dashboard section (KPI cards, severity/overdue logic, cycle-over-cycle
trends, facility/BOG rankings, AI insights, weekly/monthly reports).

**To make this real, two inputs are still needed:**

1. **The Google Sheets tracking exports** (one per auction cycle) — column
   names, exact status vocabulary used in the sheets, and a sample of the
   free-text notes column, so the import can standardize real column
   headers into the schema in `src/lib/types.ts`.
2. **The photo-upload deadline / process rule** — e.g. "deadline = photo
   request date + N business days." This is currently a placeholder
   (`PHOTO_DEADLINE_LEAD_DAYS = 10` in `src/lib/mockData.ts`) and is the
   single source of truth for every overdue/countdown/on-time calculation
   in the app.

Once both are available, replace `mockData.ts` with a real import pipeline
(Google Sheets API read → column mapping → de-dup by `sourceRowKey` →
`classifyNote()` on each note) and set the real deadline rule in
`calculations.ts`. Nothing else in the app needs to change — every
component consumes the same `EnrichedUnit[]` shape regardless of where the
records came from.

## What's implemented

- **Data model** (`src/lib/types.ts`) — unit, photo-request, delay
  responsibility, follow-up, and AI-analysis fields per the spec.
- **Calculations** (`src/lib/calculations.ts`) — days waiting, days
  overdue, deadline countdown, severity (Critical/High/Medium/Low/
  Completed), on-time/late, and the KPI roll-up.
- **Heuristic note classifier** (`src/lib/classifier.ts`) — a rule-based
  stand-in for an LLM classification step. It never guesses BOG as the
  cause without textual support; ambiguous notes are flagged `Unknown` /
  `needsReview` instead of assumed. Swap the body of `classifyNote()` for a
  real LLM call when ready — the return shape stays the same, and the
  original note text is always preserved separately.
- **Cycle & facility analytics** (`src/lib/analytics.ts`) — per-cycle and
  per-facility rollups (on-time %, BOG/owner issue %, avg response time,
  escalation rate, etc.), used by the Auction Cycle Analytics and Facility &
  BOG Performance sections.
- **AI Insights** (`src/lib/insights.ts`) — data-backed insight generation
  (BOG rate trend across cycles, which facilities drove the latest cycle's
  BOG delays, recurring multi-cycle BOG patterns, owner-vs-BOG
  disambiguation, escalation hotspots, ambiguous-note review queue).
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

- No persistence layer yet — data lives in-memory from `mockData.ts`. A
  real deployment needs a database (rows keyed by `sourceRowKey` for
  de-dup) and a Google Sheets import job.
- No auth — this is a UI prototype; Admin-only access control needs to be
  added before this goes anywhere near production data.
- The note classifier is heuristic/keyword-based, not a real LLM call —
  intentionally, since no AI provider or real note samples were available
  when this was built. It's structured so swapping in a real model is a
  one-function change.
- Manual correction of AI classifications (per the spec's "Admins can
  correct AI classifications" requirement) is modeled in the data type
  (`manualOverride` on `AuctionUnit`) but has no UI yet.
