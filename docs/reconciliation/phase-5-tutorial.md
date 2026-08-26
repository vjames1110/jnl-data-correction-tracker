# Store Reconciliation — Phase 5 Tutorial

Phase 5 of 6 (see `C:\Users\Dell\.claude\plans\steady-mixing-cherny.md` for the full roadmap). Goal: **field-usable under poor connectivity, and safe when two writes race each other.** Builds on Phase 2's entry screen and Phase 3/4's approval/reporting; no data-model changes.

## What shipped

- **Concurrency hardening**: every write that touches a period (submitting it, creating/updating/deleting an entry or a production-output row) now locks that period's row (`select_for_update`) before checking whether it's still editable. Previously two near-simultaneous requests — a double-click on Submit, or an entry save landing at the exact moment someone else submits the period — could both pass the "is this still editable" check before either committed. Now the second one always sees the first one's committed state and gets a clean rejection instead of a race.
- **Idempotent entry creation**: the client can now generate its own id for a new entry or production-output row and send it with the create request. If that same create is ever sent twice (a retried offline-queue item, a flaky connection that dropped the response but not the request), the server recognizes the id and returns the existing record instead of erroring or creating a duplicate.
- **A real client-side offline outbox** for the Monthly Entry screen: when a save fails because the device has no connectivity (or `navigator.onLine` is already false), the entry is written to `localStorage` instead of being lost, the row shows a **Queued** badge with the values still visible, and a banner tells the store user how many changes are waiting. The queue automatically replays itself the moment the browser's `online` event fires (and once on page load, in case something was left over from a previous session); there's also a manual **Sync Now** button.
- Editing the **same still-unsynced row again** before reconnecting replaces the queued action in place rather than queuing a second one — otherwise the stale first edit could still reach the server, and because it's idempotent-by-id, the real (later) edit would silently be dropped instead of overwriting it. This exact bug showed up during live testing of this phase and is now covered by a dedicated test.
- A queued production-output delete that turns out to have already succeeded (replayed after the original request's response was lost) is treated as success on a 404, not an error.

## A deliberate scope simplification (flagging per the working-style rule)

This phase makes the **write path** offline-tolerant — entering and saving numbers on a page you've already loaded. It does **not** make the **read path** offline-first: loading Monthly Entry for the first time, switching months, or the CSV bulk-import still require a live connection. The realistic field scenario this targets is a store person who opened the page while they had signal and then lost it mid-count — not a fully offline cold start. A true offline-first read layer (caching period/item data for use with zero connectivity) is a much bigger undertaking (service worker, structured local cache, conflict resolution on reconnect) and wasn't something the "~1 week" estimate for this phase was sized for; flagging it as a real gap rather than quietly declaring it covered.

*(A bounded version of the read path was built later, on request — see the addendum at the bottom of this doc. The "true cold start with zero connectivity ever" boundary described above still stands; what changed is the softer, more common case of losing signal mid-session.)*

Also, true concurrent-write races aren't exercised by an automated test — writing a reliable multi-threaded race test needs live multi-connection test infrastructure this project doesn't have (and the `corrections` app's own `select_for_update` usage, which this mirrors, doesn't have one either). The locking was verified by code review and by the idempotency tests, not by a live race harness.

## Before you start

Same two dev servers as Phase 1-4.

## Walkthrough — go offline mid-entry

1. **Store User**: open Monthly Entry for the current period, as usual.
2. Turn off your device's Wi-Fi/data (or, for a controlled test, use your browser devtools' network-throttling "Offline" preset instead of physically disconnecting).
3. A red banner appears immediately: *"You're offline — changes will be saved on this device and sent when you're back online."*
4. Fill in an item's numbers and click **Save**. No error — the row's Status column shows a **Queued** badge instead of a variance chip (there's no way to compute the real variance without hitting the server), but your typed values stay right there in the inputs.
5. Change your mind and edit the same row again while still offline, then Save again. Still just one queued item — the banner's count doesn't go up a second time.
6. Reconnect. Within a couple of seconds the banner disappears and the row updates itself with the real computed Actual/Theoretical/Variance/Status — proof the save actually reached the server, not just a local illusion.

**What to check:** the banner's queued count matches what you've actually changed; a queued **create** for a brand-new item and a queued **update** to an already-saved item both work; Production Output entries queue the same way (no visual row feedback for those yet — see the scope note); Submit Period, the CSV importer, and approval actions all still require connectivity and say so plainly rather than silently failing.

## What's deliberately NOT in Phase 5

- ~~No offline-first reads (see scope note above) — you need connectivity to open the page in the first place.~~ Partially built as a follow-up — see the addendum. A page that has *never* been loaded on this device still needs connectivity; a page that was open before and loses signal mid-session now degrades gracefully instead of erroring.
- No visual "queued" indicator on Production Output rows (only the KPI-style banner count reflects them).
- No conflict resolution UI for the rare case where a queued edit and someone else's edit to the same item both land — last-write-wins, same as the rest of this app.
- No live multi-threaded concurrency test harness (see scope note above).

## Verification already run

- Backend: `pytest apps/reconciliation` — 62/62 passing (6 new tests in `test_offline_sync.py` covering idempotent create, replay-after-submit, malformed client ids, and backward compatibility with no client id supplied). Full suite: 341/342 (the 1 failure is the same pre-existing unrelated flake from earlier phases).
- Frontend: `npm run test` — 76/76 passing; `npm run lint` clean; `npm run build` succeeds.
- Live verification used Playwright's real network-offline emulation (not a mock) end-to-end: went offline mid-session, saved an entry (queued, banner shown), edited the same row again while still offline (confirmed only one item stayed queued, not two), came back online, watched it auto-sync, and confirmed against the database directly that exactly one entry row existed with the *second* edit's value — this is what caught and proved the fix for the dedupe bug described above. Zero console errors from the offline-queue code itself; one **unrelated pre-existing issue** was surfaced during this pass and is worth a separate look: the header clock (`ServerClock`) calls an `/admin-portal/server-time/` endpoint that 403s for every non-Admin role (Director, Store HO, Store User, likely Responsible too), so the clock never populates outside the Admin portal. It's cosmetic only, doesn't affect data or this phase's functionality, and I didn't touch it — flagging it since it's a real, previously-undiscovered gap.

## Addendum — offline-first reads, bounded (built later, on request)

The read-side gap this phase deliberately flagged got a bounded fix: Monthly Entry's four cold-load queries (the period, its entries, its production-output rows, and the item master list) now write their successful response to `localStorage` every time they succeed, keyed by site/month/period. If a later fetch for the *same* key fails specifically because the device has no connectivity, the page falls back to that saved copy instead of erroring, and shows a plain banner — "Showing a saved copy" with the timestamp it was saved — so nobody mistakes it for live data.

**What this does and doesn't cover, precisely:** if you've opened a given site/month before (even once, on this device, while online), losing connectivity afterward — mid-session, or on a revisit — now shows the last-known data instead of an error. If you've *never* opened it before on this device, or you clear site data, there's nothing to fall back to and it behaves as before (needs a connection). This app still has no service worker, so a hard browser reload while fully offline can't load the JavaScript at all — that boundary from the original phase is unchanged; what's covered is losing signal while the app is already running.

Building this surfaced one real bug worth calling out: Monthly Entry's final render branch assumed that "not loading and not errored" always meant the period data was present, which mostly held under plain React Query but isn't a safe assumption to lean on with a custom `queryFn` in the mix — a stale/mismatched request during this work hit a case where the page tried to render with no period loaded and crashed instead of showing an error state. Fixed by making that branch explicitly check for the data being present, not just inferring it from the loading/error flags — a small, permanent hardening independent of the caching change itself.

**Verification**: frontend-only change (`frontend/src/services/offlineReadCache.js`, four new unit tests covering get/set/overwrite/independent-keys). Full frontend suite 80/80, lint clean, build succeeds. Live Playwright verification confirmed the cache is written correctly for all four query types after a normal load (correct keys, correct payloads) and that a genuinely offline re-fetch no longer crashes the page.
