# Store Reconciliation — Phase 2 Tutorial

> **Superseded (2026-08-26):** the "Store User" role described throughout this doc has been retired. A single **Store HO** account now enters every site's data itself, picking the site from a dropdown instead of being tied to one. See the addendum at the bottom, and `docs/reconciliation/testing-guide.md` for the current walkthrough.

Phase 2 of 6 (see `C:\Users\Dell\.claude\plans\steady-mixing-cherny.md` for the full roadmap). Goal: **a Store User can submit a full month's reconciliation for one site and see live variance.** Builds directly on Phase 1's masters — no changes to Phase 1's screens.

## What shipped

- Four new models: `ReconciliationPeriod` (one site's month), `ReconciliationEntry` (one item's monthly numbers + computed variance), `ReconciliationOutputEntry` (production batches that theoretical consumption is derived from), `ReconciliationFlag` (auto-generated data-quality flags). Plus a singleton `ReconciliationToleranceSettings` (same pattern as the existing `CorrectionAutoCloseSettings`).
- The variance engine (`apps/reconciliation/services/variance.py`): resolves the effective rate/mix ratio (reusing Phase 1's three-tier resolution), computes actual/theoretical (or actual/book), variance quantity and value, classifies status (Within Tolerance / Watch / Over Tolerance), and auto-generates flags — negative consumption, no matching production, missing rate/mix, over tolerance. Recomputes automatically on every entry save and every production-output change.
- A new **Monthly Entry** screen in the Store portal (`/store/entry`): one table with every active item, editable inline, showing live actual/theoretical/variance/status after each save; a Production Output section for norm-based items; a book-stock CSV upload (client-side parse, same pattern as the existing ERP import screen); a Submit Period action that locks the period.
- A new **Tolerance Settings** admin screen under Store Reconciliation.
- Site-scoping: a Store User only ever sees/edits their own site's periods (resolved from their Employee Profile's site); Store HO/Admin can work with any site.

## A deliberate scope simplification (flagging per the working-style rule)

The original prompt described mix ratios varying **by production grade** (e.g. cement per m³ differs between M20 and M25 concrete). Building that fully would mean adding a grade dimension to `ItemStandard`/`SiteItemConfig` and a 4-tier resolution lookup. For Phase 2 I shipped a single **blended** mix ratio per item instead — `ReconciliationOutputEntry.grade_label` is captured for audit/reporting only, not used in the ratio lookup yet. This keeps the phase's scope fully demoable end-to-end. Grade-specific ratios are a natural, contained refinement for a later phase if you want that precision — let me know if you'd rather pull it forward.

**Update (built as a follow-up, see the addendum at the bottom of this doc):** grade-specific mix ratios are now live — this simplification has been resolved, not just flagged.

I also found, while building the book-stock CSV import, that requiring *all* of opening/receipts/closing (or book/physical) up front would have blocked the real workflow (book stock arrives via CSV before the store person enters a physical count). I relaxed that: an entry can be saved with partial data and simply stays "Pending" (not flagged as a data-quality problem) until it's complete.

## Before you start

Same two dev servers as Phase 1:

```bash
cd backend && ./venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
cd frontend && npm run dev
```

You'll need: an Item Category, at least one Norm Based item and one Direct Count item (Phase 1's screens), a Company Default rate/mix for each, and a Store User account whose Employee Profile has a site assigned (Admin → User Management → Add Employee, role **Store User**, then make sure their Employee Profile has that site — the "can't select site hod" fix from earlier this session applies the same way here).

## Walkthrough — a full month, start to finish

1. **Admin**, if not already done in Phase 1: create an item category, a norm-based item (e.g. cement, UOM MT) and a direct-count item (e.g. steel, UOM MT), and a Company Default rate/mix for each under Store Reconciliation.
2. **Store User**: log in, click **Monthly Entry** in the sidebar (or **Go To Monthly Entry** from the dashboard). The current month's period for your site is fetched (created automatically the first time you visit it) — status starts **Draft**.
3. Under **Production Output**, add a batch for the norm-based item: pick the item, an optional grade note, and a quantity (e.g. 100). This is what theoretical consumption gets calculated against.
4. In **Reconciliation Entries**, fill in the norm-based item's Opening / Receipts / Closing and click **Save**. Watch Actual, Theoretical/Book, Variance, and Status populate immediately — no page reload.
5. For the direct-count item, either:
   - type Book Stock and Physical Count directly and Save, or
   - click **Upload Book Stock CSV** with a two-column file (`item_code,book_stock`) to fill in Book Stock from an ERP export, then come back later and fill in just Physical Count once it's counted. The row shows **Pending** with no flag until both are present — that's expected, not an error.
6. If a variance breaches tolerance, a colored **Over Tolerance** / **Watch** flag badge appears under the status chip with a tooltip explaining why (hover it).
7. Click **Submit Period**. The whole screen becomes read-only immediately — inputs, the CSV upload, and the output form all disappear, replaced by a "submitted and read-only" message. Try editing again (or hit the API directly) and it's rejected with a 400.

**What to check:** the KPI-style summary line ("Entries: N | Flags: N") updates live as you save; switching the month selector before submitting jumps to a different period for the same site (each site+month pair is its own period); a Store HO or Admin account gets a Site picker instead of an implicit site, and can view/edit any site's period the same way.

## What's deliberately NOT in Phase 2

- No approval routing — "Submit" just locks the period; there's no Store HO/Director sign-off step yet (that's Phase 3).
- No reporting/dashboard views of reconciliation data for Director/Admin (Phase 4).
- No grade-specific mix ratios (see the scope note above).
- No offline queue-and-sync for poor connectivity (Phase 5) — the screen is responsive but requires a live connection today.

## Verification already run

- Backend: `pytest` — 310/311 passing (the 1 failure is the same pre-existing unrelated flake from Phase 1, documented in project memory).
- Frontend: `npm run test` — 76/76 passing; `npm run lint` clean; `npm run build` succeeds.
- Live click-through (Playwright): full admin masters setup → Store User production output + entries with live variance/status/flags rendering correctly (verified the exact expected numbers: 32.000 actual vs 32.000 theoretical → Within Tolerance; 48 vs 50 → Over Tolerance) → period submit → read-only lockout confirmed → book-stock CSV upload → completing a partial entry → re-classification to Watch, all with zero console/network errors.
- Two real bugs found and fixed during this verification pass (not scope creep — both directly blocked the phase's own deliverable): a Decimal-precision mismatch in the variance calculation (fixed by quantizing before assignment), and the entry-row input not refreshing after a CSV import populated it from outside the row's local form state (fixed by keying the row on the entry's update timestamp).

## Addendum — grade-specific mix ratios (built later, on request)

The blended-ratio simplification above stood until the user asked for it to be built out. Here's what changed.

**Model**: `ItemStandard` and `SiteItemConfig` both gained an optional `grade_label` field (blank = applies to every grade of that item; set it, e.g. "M20", to override just that grade). A row is always self-contained — rate and mix ratio come from the *same* row, never mixed across rows, so there's never ambiguity about which row "won." The uniqueness constraints and the site "locked" constraint both now key on `(item, site, grade)` instead of `(item, site)`, so a site can lock its blanket default independently of any grade-specific overrides.

**Resolution** (`services/resolution.py`): four tiers instead of two — site+grade → site blanket → company+grade → company blanket. `ReconciliationOutputEntry.grade_label` (now uppercased on save, same as the standard rows, so "m20" and "M20" always match) is what gets looked up.

**Variance calculation**: theoretical consumption is now computed **per production grade and summed** — 100 m³ of M20 and 100 m³ of M25 each resolve their own mix ratio and contribute their own share, rather than one blended ratio applied to the combined total. The cost side (`variance_value`) uses a quantity-weighted average rate across the grades produced that period, since actual consumption itself still isn't split by grade in this model (only the aggregate opening/receipts/closing is recorded) — flagged here as the honest limit of what's derivable from the current data model, not silently smoothed over. If a grade was produced but has no resolvable standard at all (not even the blanket fallback), the entry stays `NOT_CALCULATED` with a `MISSING_MIX_OR_RATE` flag, same as the existing "nothing configured" case.

**Admin UI**: the Company Defaults and Site Overrides screens both gained an optional "Grade" field (shown only for norm-based items) and a Grade column in their tables, showing "All grades" when blank.

**Verification**: 8 new backend tests in `test_grade_resolution.py` (resolution tier ordering, case-insensitive matching, blended-vs-per-grade variance, weighted-average costing, missing-grade-config flagging) plus the full existing suite still passing unchanged with no grade data present (349/350, same pre-existing flake). Live Playwright check: configured M20 (mix ratio 0.30) and M25 (0.40) company defaults for one item, recorded 100 units of production under each grade, and confirmed the Monthly Entry screen computed theoretical consumption as exactly 70.000 (100×0.30 + 100×0.40) — the blended-only calculation would have shown a different number.

## Addendum — Store User retired, Store HO does everything (built later, on request)

The company runs this module with a single operator, not a separate data-entry person per site — so the whole "Store User" concept from this phase (a role locked to one site, resolved from its Employee Profile) has been removed entirely, not just deprecated.

**What changed**: the `STORE_USER` role no longer exists (removed from the `UserRole` choices, with a migration; the one real leftover test account with that role was reassigned to Store HO). Monthly Entry's site-picker — previously shown only to Store HO/Admin — is now the only way anyone enters data: Store HO always chooses which site they're working on from a dropdown, the same screen either way. All backend site-scoping machinery (`is_site_scoped_user`, `ensure_site_access`, `user_home_site_id`) was removed as dead code, since nothing needs it anymore — Store HO always had cross-site reach, it just wasn't the only path in before.

This also simplified the approval route — see the addendum in `docs/reconciliation/phase-3-tutorial.md` for that half of the change (Store HO no longer approves at all; Director approves directly).

**Verification**: full backend suite 363/364 (same pre-existing flake), all reconciliation tests rewritten around Store HO as the preparer rather than a separate role — no test asserts site-scoping behavior anymore, since nothing is site-scoped. Frontend 80/80, lint/build clean. Live Playwright check: a fresh Store HO account entered and submitted data for two different sites in the same session via the site picker, with no separate "Store User" account involved anywhere.
