# Store Reconciliation — Phase 1 Tutorial

Phase 1 of 6 (see `C:\Users\Dell\.claude\plans\steady-mixing-cherny.md` for the full roadmap). This phase ships **foundations & masters only** — no data entry, no approval workflow yet. It proves out the new Django app, the two new roles, the admin CRUD screens, and the three-tier rate/mix inheritance model end to end.

## What shipped

- New Django app `apps/reconciliation` with four models: `ItemCategory`, `Item`, `ItemStandard` (company-wide default rate/mix), `SiteItemConfig` (site-level override).
- Two new roles: **Store HO** (reviews/approves — added to the approval chain in a later phase) and **Store User** (site-level data entry — added in Phase 2). Both can log in today; only Store HO/User get the empty "Store Reconciliation" portal for now.
- Admin screens under a new **Store Reconciliation** sidebar item: `Item Categories`, `Items`, `Company Defaults`, `Site Overrides` — same look, filters, export, and activate/deactivate pattern as the existing ERP master pages.
- The resolution logic for the three-tier model (site override → company default → nothing configured) is implemented and unit-tested (`apps/reconciliation/services/resolution.py`), but not yet wired into any UI — there's nothing to reconcile against until Phase 2 adds monthly periods and entries.
- Along the way, found and fixed two **pre-existing** bugs in the shared login flow (`GuestRoute.jsx`, `LoginPage.jsx`) that hardcoded a role→dashboard lookup table missing anything beyond Admin/Director/Responsible. This silently would have broken a fresh Store HO/User login (and, it turns out, already affected any freshly-added role) — fixed by routing through the existing `portalBasePath()` helper instead. Full regression suite re-run to confirm this didn't change behavior for existing roles.

## Before you start

Two dev servers, same as always:

```bash
# backend
cd backend && ./venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000

# frontend
cd frontend && npm run dev
```

Frontend is at `http://localhost:5173`, backend API at `http://localhost:8000`.

## Walkthrough 1 — Admin sets up the masters

1. Log in at `http://localhost:5173/admin/login` with your existing Super Admin or Admin account.
2. In the left sidebar, click **Store Reconciliation** (new item, between "Voucher Configuration" and "Correction Requests").
   - You land on a summary page with four KPI cards (Item Categories, Items, Company Defaults, Site Overrides) and shortcut tiles — all zero on a fresh setup.
3. Click **Item Categories** → **Add Category**. Enter a name, e.g. `Cement`. Save.
   - Notice the code (`CEM`) is auto-generated, same convention as Reason Categories/Voucher Types elsewhere in the app.
4. Click **Items** (in the sidebar overview, or via the shortcut tile) → **Add Item**.
   - Name: `OPC 43 Grade Cement`. Category: `Cement`. Reconciliation Type: **Norm Based**. UOM: `MT`. Save.
   - Try creating a **Direct Count** item too (e.g. `TMT Steel Bars`, category `Steel`, UOM `MT`) to see both calculation types represented.
5. Click **Company Defaults** → **Add Default**.
   - Select the cement item. Because it's norm-based, a **Mix Ratio** field appears (this is conditional — direct-count items never show it, and the backend rejects a mix ratio submitted for a direct-count item). Enter Rate `6500`, Mix Ratio `0.32`, Effective From today's date. Save.
   - This is Tier 1 of the three-tier model: the company-wide default every site uses unless it has its own figures.
6. Click **Site Overrides** → **Add Override**.
   - Pick a site and the same cement item, enter a different rate (e.g. `6600`), save.
   - This is Tier 2. From this point, that site is "locked" to its own figure — changing the company default in step 5 no longer affects it. Deactivating this override (the power icon) hands the site back to the company default, same activate/deactivate pattern as every other master in this app.

**What to check:** row counts on the Store Reconciliation overview page update as you go; export buttons produce CSVs matching the visible columns; deactivating/reactivating a category or item behaves like every other ERP master screen (soft toggle, not delete).

## Walkthrough 2 — Store HO / Store User portal

1. As Admin, go to **User Management** → **Add Employee**. Set Role to **Store HO** (or **Store User**), fill in the rest, create the account with a login (unlike "Employee", these roles get dashboard access by default).
2. Log out, log back in as that new account at `/admin/login`.
3. You should land directly on `/store/dashboard` — a sidebar reading "Store Reconciliation / Store HO Portal" (or "Store User Portal"), a header reading "Store Reconciliation Portal", and an empty-state card: *"Nothing to reconcile yet."* That's expected — Phase 2 is what puts something there.
4. Try navigating directly to `/admin/reconciliation` (or any other `/admin/...` URL) while logged in as this account — you should get the "Access denied" 403 page, not the admin screen. Store roles can't reach admin-only setup pages, and vice versa an Admin-only account can't reach `/store/dashboard` without also holding an admin/store role.

## What's deliberately NOT in Phase 1

- No monthly reconciliation periods, no data entry form, no variance calculation on screen (the calc *service* exists and is tested, just not wired to a UI yet).
- No approval workflow — Store HO's dashboard is a placeholder.
- No director/admin reporting dashboard for reconciliation data — nothing exists yet to report on.
- The "month-only" third tier of the rate/mix model (as opposed to the company-default and site-standing tiers, both live today) is deferred to Phase 2, since it needs `ReconciliationPeriod` to exist to mean anything.

## Verification already run

- Backend: `pytest` — 293/294 passing (the 1 failure is a pre-existing, unrelated flaky ordering test in `test_erp_api.py`, documented in project memory, not caused by this work).
- Frontend: `npm run test` — 76/76 passing; `npm run lint` clean; `npm run build` succeeds.
- Live click-through (Playwright): admin creates a category → item → company default → site override, all persist and render correctly; a fresh Store HO login lands on its own portal and is correctly blocked from admin routes, and vice versa.

## Known pre-existing issue (unrelated)

`frontend/index.html`'s favicon `href` changed to `/jnl-logo` (a path that doesn't exist) at some point in an earlier session — not something introduced by this work, flagged but left as-is pending your decision on whether to restore `/favicon.svg`.

## Addendum — Store HO self-service masters (built later, on request)

Everything in Walkthrough 1 above was Admin-only when this phase shipped. On request, **Store HO** got the same master-data management ability — item categories, items, company defaults, site overrides, and tolerance settings — from their own portal, so a site rollout (adding a new material, correcting a rate) doesn't have to wait on an administrator every time.

**What shipped:** a new **Settings** entry in the Store HO sidebar (`/store/settings`), landing on the exact same overview page style as the Admin one (KPI cards + shortcut tiles), with the same five management screens mounted underneath (`/store/settings/categories`, `/items`, `/standards`, `/site-configs`, `/tolerance-settings`). These are the *same* React components the Admin portal already used — nothing was duplicated — just mounted at new routes and gated to Store HO only (a new `StoreHoRoute` guard; Store User still can't reach them). Each page's "Overview" back-link is now role-aware, so a Store HO's back button returns to `/store/settings`, not the Admin dashboard they don't have access to. On the backend, `HasReconciliationMasterAccess` now recognizes Store HO alongside Admin/Super Admin for every write (create/update/activate/deactivate) across all four masters, and Store HO can also see and reactivate previously-deactivated records (a visibility rule that used to be Admin-only), plus update tolerance settings.

**Verification**: 4 new backend tests (Store HO creating a category/item, seeing + reactivating an inactive category, updating tolerance settings) — all passed alongside the full 366/367 backend suite (same pre-existing flake). Frontend lint/build/tests all clean. Live Playwright walkthrough: logged in as a fresh Store HO account, opened Settings, created a brand-new item category entirely from the Store HO portal, confirmed it appeared in the list, and confirmed the Overview link correctly returned to `/store/settings` rather than the Admin route.
