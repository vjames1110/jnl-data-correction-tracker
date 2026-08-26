# Store Reconciliation — Phase 4 Tutorial

Phase 4 of 6 (see `C:\Users\Dell\.claude\plans\steady-mixing-cherny.md` for the full roadmap). Goal: **a demoable executive view that answers "which sites and which items have the biggest discrepancies this month?"** — the metric the plan was refined with at the start of this phase. Builds on Phase 2's entries/variance engine and Phase 3's approval data; no changes to either.

## What shipped

- Three new aggregation queries in `apps/reconciliation/selectors/dashboard.py` (kept out of the API views, per the app's own planned file tree, so they're independently testable):
  - **Site leaderboard** — every site with at least one entry this month, ranked worst-first (most Over Tolerance entries, then most Watch, then largest total variance value).
  - **Item leaderboard** — same ranking, but per item across every site, plus how many distinct sites are currently showing a Watch/Over Tolerance reading for that item (`sites_affected`) — this is the "which material keeps causing problems everywhere" metric.
  - **Company summary** — total entries and status breakdown, flag-type totals, and **sites reporting vs. not reporting** (how many active sites haven't recorded anything at all this month — a compliance gap the site leaderboard alone can't show, since a silent site never appears on it).
- A 6-month trend (company-wide status counts per month) for a stacked bar chart — the plan's "real charting library, not static images" requirement, using the `recharts` dependency already in the project.
- One new read-only endpoint, `GET /api/v1/reconciliation/dashboard/?month=YYYY-MM-DD` (defaults to the most recent month with any data, so the view is never empty on a fresh visit), returning all four pieces in one response.
- One new page, **Variance Reports**, mounted at three routes with the same component (matching the Phase 3 approval-inbox pattern): `/director/reconciliation` (new Director sidebar entry), `/admin/reconciliation/reports` (new shortcut tile on the Store Reconciliation admin dashboard), and `/store/reports` (new Store HO-only sidebar entry — Store User doesn't get it, they only ever see their own site via Monthly Entry).
- A **Print Report** button on the Reports page and a **Print Statement** button on the Monthly Entry screen, both using the browser's native print (a new print stylesheet hides the sidebar/header/action buttons and adds a print-only title line) — this is the prompt's "print-ready statement per site, and a combined multi-site pack" requirement.

## A deliberate scope simplification (flagging per the working-style rule)

The prompt's "multi-site pack" was originally imagined as a possible separate concatenated document. I realized the **Reports page itself already is the multi-site pack** — it's company-wide, print-ready, and shows every site side by side — so I didn't build a second, separate export path for it. The single-site "statement" is the existing Monthly Entry screen's read-only view with a print button added. Both use the browser's print-to-PDF, not a server-side PDF generator — no new dependency, and it's the same approach print-ready screens elsewhere in this codebase would take if they existed. If you want a literal one-click "download PDF for every site" batch export later, that's a contained follow-up (likely a background job + zip, given the volume), not something this phase quietly cut corners on.

## Before you start

Same two dev servers as Phase 1-3. You'll need entries recorded for at least one site this month (Phase 2's Monthly Entry screen) — the Reports page has nothing to rank until then, and will say so plainly (KPI cards still show, e.g., "0 / N sites reporting").

## Walkthrough

1. **Director**, **Store HO**, or **Admin**: open **Store Reconciliation** (Director sidebar) / **Reports** (Store HO sidebar) / **Store Reconciliation → Variance Reports** (Admin dashboard tile). All three land on the exact same screen and data — there's no separate "admin view" vs "director view" to keep in sync.
2. The month picker defaults to the most recent month that actually has data. Change it to jump to any other month.
3. **KPI row**: Sites Reporting (e.g., "2 / 17" — the other 15 haven't recorded anything this month, which is itself worth flagging to someone), Total Entries, and the three variance-status counts.
4. **6-Month Trend**: a stacked bar per month, oldest to newest, so a worsening or improving pattern is visible at a glance.
5. **Site Leaderboard**: the worst site is always row one. Click through mentally to Monthly Entry (same site/month) if you want the underlying numbers — the leaderboard intentionally doesn't try to replace that screen, just points at where to look.
6. **Item Leaderboard**: same ranking, but by material. `Sites Affected` tells you whether a bad item reading is a one-off or a pattern across the company (e.g., a mix ratio that's wrong everywhere vs. one site's data-entry mistake).
7. Click **Print Report** (or **Print Statement** on Monthly Entry) — the browser's print preview shows a clean page with the sidebar, header, and buttons stripped out and a title line identifying what's being printed.

**What to check:** a Store User account has no "Reports" nav item and gets a 403 if they hit the API directly (they're restricted to their own site by design, unlike Director/Store HO/Admin who all work across every site); switching the month picker re-ranks both leaderboards live; a month with zero entries anywhere shows empty-state messages instead of blank tables.

## What's deliberately NOT in Phase 4

- ~~No per-site batch PDF export (see scope note above).~~ Built as a follow-up — see the addendum at the bottom of this doc.
- No saved/scheduled reports or email digests.
- No drill-down click-through from a leaderboard row straight into that site's entries (today you'd navigate to Monthly Entry and pick the site/month yourself).
- No mobile/offline handling for this screen specifically (that's Phase 5, company-wide).

## Verification already run

- Backend: `pytest apps/reconciliation` — 56/56 passing (10 new selector/API tests in `test_dashboard.py`, covering ranking order, the sites-not-reporting count, trend shape, and role-based access — Director/Store HO/Admin allowed, Store User forbidden). Full suite: 335/336 (the 1 failure is the same pre-existing unrelated flake from Phase 1-3).
- Frontend: `npm run test` — 76/76 passing; `npm run lint` clean; `npm run build` succeeds.
- Live click-through (Playwright) with real cross-site data (two real sites, one pushed deliberately over tolerance): confirmed the identical Reports page renders correctly and shows the same ranked data in all three mount points — Director, Store HO, and Admin portals — with zero console/network errors, and confirmed a Store User sees no Reports link in their sidebar.

## Addendum — multi-site statement pack (built later, on request)

The "no per-site batch PDF export" simplification above stood until the user asked for it to be built. Here's what changed, and why it isn't a PDF/zip pipeline after all.

**Why not a server-side PDF export:** this backend has no PDF library and no background task queue (checked `requirements/production.txt` before starting). Adding one — most HTML-to-PDF libraries need system-level Cairo/Pango packages — risks breaking the Render deployment for a feature that doesn't need that complexity at this scale (a few dozen sites, not thousands). The single-site "Print Statement" and the Reports page's "Print Report" already solve this the same way: render a clean page, let the browser's native print-to-PDF handle the "save as PDF" step. The multi-site pack follows the identical pattern instead of introducing a new one.

**What shipped:**
- One new read-only endpoint, `GET /api/v1/reconciliation/statement-pack/?month=YYYY-MM-DD` (same month-resolution behavior as the dashboard endpoint — defaults to the most recent month with data). Returns full entry-level detail (every item, opening/receipts/closing, actual/theoretical/variance/status, production output) for every site that recorded at least one entry that month, ordered by site name. Sites with no entries are left out, matching the Reports page's leaderboard semantics.
- One new page, **Multi-Site Statement Pack**, mounted at the same three routes as the other reconciliation-reporting pages: `/director/reconciliation-pack`, `/admin/reconciliation/statement-pack`, `/store/statement-pack`. Reachable via a "Multi-Site Statement Pack" link on the Variance Reports page (not a separate sidebar entry, to avoid nav clutter across three portals) and a shortcut tile on the Admin dashboard.
- Each site's statement renders as its own card, one after another; a **Print Pack** button triggers the browser's print dialog, and a new print rule (`break-after: page` per site) puts each site on its own printed page automatically.

**Verification**: 4 new backend tests (`test_statement_pack.py` — sites-with-no-entries excluded, empty-month handling, Director access, Store User forbidden). Full suite 353/354 (same pre-existing flake). Frontend 76/76, lint/build clean. Live Playwright check with two real sites (one deliberately pushed over tolerance) confirmed both statements render with correct per-item figures in the Director portal, reached via the Reports page's link.

## Addendum — site filter (built later, on request)

The pack was all-sites-or-nothing; it now takes an optional `site` filter alongside the month picker, in all three portals it's mounted in (Director, Admin, Store HO). `build_statement_pack()` gained a `site_id` parameter that narrows the query before it ever builds the entry list; the page gained a "Site" dropdown (default "All sites") next to the month picker, reusing the same sites-dropdown hook the Monthly Entry page's site picker uses. Verified live: selecting one site out of two correctly re-rendered the pack down to just that site's statement.
