# Store Reconciliation — Phase 3 Tutorial

> **Superseded (2026-08-26):** the approval route described in this doc (Store HO reviews, then Admin gives final approval) no longer exists. Store HO now only prepares and submits; **Director approves directly**, single level, no Store HO review step. See the addendum at the bottom, and `docs/reconciliation/testing-guide.md` for the current walkthrough.

Phase 3 of 6 (see `C:\Users\Dell\.claude\plans\steady-mixing-cherny.md` for the full roadmap). Goal: **a submitted period routes through real sign-off, with a full audit trail, instead of just locking.** Builds directly on Phase 2's entries/variance engine — no changes to Phase 1/2 screens beyond the entry page gaining a status banner.

## What shipped

- A new `ReconciliationApprovalStep` model — one row per approval level per submission round, mirroring the shape of the existing `CorrectionApprovalStep` (same `ApprovalStepStatus` enum: Pending / Approved / Rejected / Returned / Skipped) but living in the reconciliation app, since the two apps' submission objects (a voucher-level correction vs. a whole month's stock reconciliation) don't share a common "approvable" base to plug into.
- A route builder: **Store HO** first (if one exists), then **Admin/Super Admin** as the final level — resolved automatically at submit time, no manual policy configuration needed for this phase.
- **Submit** (Store User, same button as Phase 2) now actually starts the approval route instead of just locking the period: it goes to **Pending Approval** and the first approver gets notified.
- **Approve** — advances to the next level, or (on the last level) finalizes the period as **Approved**, which is permanently locked — the prompt's "a store user should never be able to edit an approved design mix or a confirmed rate" requirement.
- **Return For Correction** — sends the period back to **Draft** with a required comment; the store user sees exactly why and can fix the numbers and resubmit. A resubmission creates a fresh round of approval steps (round 2, 3, ...) so every round's decisions stay on record — nothing gets silently overwritten.
- **Reject** — a required-comment, terminal close-out for the rare case a period needs to be thrown out outright (see the scope note below).
- Admin or Store HO acting on someone else's step (override) is allowed and recorded the same way corrections already does it.
- A new **Approval Inbox** screen, the same component mounted at two routes: `/store/approvals` (Store HO's own portal) and `/admin/reconciliation/approvals` (Admin/Super Admin, since they're also a valid final-approval level). Each row shows who submitted, entry/flag counts, the current level, a comment box, and Approve / Return / Reject buttons.
- The Monthly Entry screen now shows a status banner: who it's waiting on while Pending Approval, the return/reject comment when applicable, and a locked confirmation once Approved.
- Notifications reuse the existing `Notification` model exactly as planned — five new event types (`RECONCILIATION_SUBMITTED`, `_APPROVAL_PENDING`, `_APPROVED`, `_REJECTED`, `_RETURNED`) with `correction_request` left `null`, deep-linking to the entry screen or the inbox.

## A deliberate scope simplification (flagging per the working-style rule)

The original Phase 2 "Submit" button just locked the period (status `Submitted`) with no real approval underneath it — a stand-in until this phase existed. Phase 3 changes what Submit *does*: it now builds the route and moves straight to `Pending Approval`. If you have old test data sitting in the now-unused `Submitted` status from Phase 2 testing, treat it as stale; new submissions never stop there.

I also chose **not** to build a way to un-reject a `Rejected` period back to `Draft` — reject is meant for the rare "this whole month's submission was invalid" case, not routine corrections (that's what Return is for). A rejected period stays a permanent, read-only record. If real usage shows rejection needs its own restart path, that's a small, contained follow-up.

*(Built later, on request — see the addendum at the bottom of this doc: a "Reopen For Correction" action now exists for exactly this case.)*

## Before you start

Same two dev servers as Phase 1/2:

```bash
cd backend && ./venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
cd frontend && npm run dev
```

You'll need: everything from Phase 1/2 (an item with a company default rate/mix, a Store User with a site), plus **one Store HO account** (Admin → User Management → Add Employee, role **Store HO** — no site needed, they work across all sites) so there's someone for a submitted period to route to. If no Store HO exists yet, submission still works — it routes straight to the first Admin/Super Admin instead — but the inbox is a nicer demo with a real Store HO in the loop.

## Walkthrough — submit, return, fix, approve

1. **Store User**: fill in the month's entries as in Phase 2, then click **Submit Period**. The card now shows status **Pending Approval** and a banner: *"Awaiting approval — Store HO: \<name\>"*. The screen is read-only, same as before.
2. **Store HO**: log in, click **Approvals** in the sidebar. The submitted period appears with its entry/flag counts and who submitted it.
3. Type a comment and click **Return For Correction**. The period disappears from the inbox.
4. **Store User**: revisit Monthly Entry for that month. Status is back to **Draft**, with a banner showing exactly what was returned and why. Fix the flagged entry and click **Submit Period** again — this creates a fresh round of approval (the old, already-decided round stays on record for audit, it's not overwritten).
5. **Store HO**: back in the inbox, click **Approve** (no comment needed for approve). If an Admin/Super Admin also exists, the period stays **Pending Approval** and moves to them as the next level — the inbox will show it under **Current level: Admin Final Approval**.
6. **Admin**: open Store Reconciliation → **Approval Inbox** (same screen, mounted in the admin portal) and click **Approve**. The period becomes **Approved** — permanently locked, entries can never be edited again, and the store's banner shows "Approved by \<name\>."

**What to check:** the notification bell badge increments for both the submitter and each approver at every handoff; a Store User or a Store HO who isn't the assigned approver gets a 403 if they try to act on someone else's step (the API enforces this even if a UI button were somehow clicked); `Reject` behaves like Return but is terminal — try it on a throwaway test period, not one you want to keep working with.

## What's deliberately NOT in Phase 3

- ~~No un-rejecting a period (see scope note above).~~ Built as a follow-up — see the addendum at the bottom of this doc.
- No configurable approval policy (site/amount-based routing like corrections has) — the route is always Store HO → Admin, fixed for this phase. (Director now also has override power to act on any pending step — see the addendum — but that's not a route change.)
- No reporting/dashboard rollups of approval turnaround time (Phase 4).
- No offline queue-and-sync for the approval actions themselves (Phase 5).

## Verification already run

- Backend: `pytest apps/reconciliation apps/notifications` — 56/56 passing (10 new service-level tests in `test_approvals.py`, 5 new/updated API tests in `test_period_api.py`). Full suite: 325/326 (the 1 failure is the same pre-existing unrelated flake from Phase 1/2, documented in project memory).
- Frontend: `npm run test` — 76/76 passing; `npm run lint` clean; `npm run build` succeeds.
- Live click-through (Playwright), full round-trip with real accounts across three roles: Store User submits → Store HO returns with a comment → Store User sees the exact comment and resubmits → Store HO approves (advances to Admin) → Admin approves via the admin-mounted inbox → Store User sees the final locked, read-only "Approved" state. Notification badge count increased at each handoff (4 → 6 → 8), confirming delivery end-to-end. Zero console/network errors across all six screens involved.

## Addendum — Director override + Reopen For Correction (built later, on request)

Two things came out of a later request: "Director can see Store Reconciliation but can't approve it," and a request to build the un-reject flow this phase had deliberately deferred.

**Director override.** Rather than inserting Director as a fixed extra stage in every route (which would force every single submission through them), Director got the same override power Admin/Super Admin already had: they can act on the *current* pending step of any period directly, from their own portal, without being the formally assigned approver. The route itself is unchanged — still Store HO → Admin final — Director just gets to reach in and approve/return/reject at any point. A new **Reconciliation Approvals** page appeared in the Director sidebar (`/director/reconciliation-approvals`), the same shared Approval Inbox component already used by Store HO and Admin. On the backend, `ReconciliationPeriodViewSet`'s four approval actions (`pending_approvals`, `approve`, `reject`, `return`) now use a reporting-style permission (Director/Store HO/Admin/Super Admin) instead of the store-portal-only one, and the "who can override the assigned approver" check now recognizes Director as well as Admin.

Building this surfaced a real bug: `approvals.py`'s internal `_validate_action_allowed` was re-deriving its own narrow "is this an admin" check instead of trusting the `allow_admin` flag the caller had already computed — so passing `allow_admin=True` for a Director did nothing, silently blocking the override. Fixed by trusting the caller's flag directly (it's the same fix that makes any *future* override role work without another round-trip through this function).

**Reopen For Correction.** A `Rejected` period can now go back to `Draft` via a new `reopen` action (`POST /reconciliation/periods/{id}/reopen/`), available to Store HO, Director, and Admin/Super Admin. It only works on a `Rejected` period (anything else is rejected with a 400). The rejected round's approval steps are left exactly as they were — untouched, permanent history — a resubmission after reopening starts a fresh round, same as after a Return. The store user gets a notification explaining who reopened it and why. On Monthly Entry, a **Reopen For Correction** button appears next to the rejected-status banner, visible to Store HO only (Store User can't reopen their own rejection, by design — that would defeat the point of Reject being a deliberate, harder stop than Return).

**Verification**: 9 new backend tests across `test_period_api.py` (Director sees/approves any pending period, Store User still can't see the inbox, reopen happens/notifies/requires Rejected status, Store User is blocked from reopening) — plus the `_validate_action_allowed` fix is covered by the existing admin-override test. Full suite 366/367 (same pre-existing unrelated flake). Live Playwright walkthrough: Store User submitted → Director approved directly from the Director portal (advancing the route to Admin) confirming the override actually works end-to-end; separately, Store HO rejected a period, reopened it, and the Store User successfully resubmitted it — all screenshotted and confirmed against real data.

## Second addendum — Store HO removed from the route entirely, Director-only (built later, on request)

The Director-override addendum above still assumed the original two-level route (Store HO review, then Admin final approval), with Director able to reach in and act at either level. That's changed again: **Store HO is no longer an approver at all.** Store HO prepares and submits every site's period (see the Store-User-retired addendum in `docs/reconciliation/phase-2-tutorial.md`); the route is now a single level, **Director only**. Admin/Super Admin keep the override power they always had (can act on the Director's step directly), but the normal path is submit → Director approves.

**What changed**: `services/approvals.py`'s `build_approval_route()` now calls a new `find_primary_director()` (mirroring the old `find_store_ho()`/`find_primary_admin()` shape it replaced) and returns a single `DIRECTOR`-type step, or an empty route if no active Director exists (submission then fails with "No active Director is configured," same pattern as the old missing-approver error). `HasReconciliationApprovalAccess` is a new permission class — Director/Admin/Super Admin only — applied to the four approval actions (`pending_approvals`, `approve`, `reject`, `return`), so Store HO gets a clean 403 hitting any of them, not just an empty inbox. Reopen is unaffected — Store HO can still reopen its own rejected period (that's recovering from a rejection, not approving), still gated by the broader `HasReconciliationReportingAccess`.

**Verification**: `test_approvals.py` rewritten around a Director-only route (route ordering, submit/approve/reject/return, admin override all retested against Director instead of Store HO); `test_period_api.py` gained `test_store_ho_cannot_approve_or_see_approvals` confirming the 403. Full suite 363/364 (same pre-existing flake). Live Playwright walkthrough: Store HO submitted a period for one site, and the Director's inbox showed **"Current level: Director"** immediately — no Store HO review step in between — confirming the single-level route end-to-end.
