# Store Reconciliation — Complete Testing Guide

A plain-language, step-by-step walkthrough of the whole Store Reconciliation module: who does what, how to set it up with a realistic multi-material item list, how to enter and submit a month, how it gets approved, and how to read every section of the reports and statements. Written for testing, not for developers — no code, just clicks, in order, with one worked example running all the way through.

If you only want to test one piece, jump to its section. If you want to see the whole thing work end-to-end, follow it in order — each part uses the data the previous part created.

## The three roles, in one sentence each

| Role | What they do here |
|---|---|
| **Admin / Super Admin** | Sets up items and rates (Store HO can too), sees everything, can approve as a backup to Director. |
| **Store HO** | The one operator who runs this module day to day. Sets up items/rates, enters and submits every site's month (picking the site from a dropdown — there's no separate site-locked account), and can reopen a rejected month. Does **not** approve. |
| **Director** | Gives the (single) approval on every submitted month. |

There is no "Store User" role — the company runs this with one Store HO operator entering data for every site, not a separate person per site.

Two servers, same as always:

```bash
cd backend && ./venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
cd frontend && npm run dev
```

Frontend at `http://localhost:5173`, backend at `http://localhost:8000`.

---

## Part 1 — Set up the masters (Admin *or* Store HO)

"Masters" means: what items exist, what they cost, and — for materials like concrete where you can't just count bags — what recipe (mix ratio) turns production into expected consumption. Do this once per item; it's reused every month after. This part sets up **five items** so the worked example below actually exercises the multi-material statement layout (Section 1 columns, Section 2/3 grade breakdowns) instead of a single-item table.

Either an **Admin** or the **Store HO** can do this whole part. Admin uses the sidebar's **Store Reconciliation** entry; Store HO uses **Settings** in their own sidebar. Same screens either way.

1. **Log in** as Admin (or Store HO) at `http://localhost:5173/admin/login`.
2. Open **Store Reconciliation** (Admin) or **Settings** (Store HO). You land on an overview with counters — Item Categories, Items, Company Defaults, Site Overrides — all zero on a fresh setup.
3. **Item Categories → Add Category.** Name it `Concrete Materials`. Save — a short code (e.g. `CONMAT`) is generated for you automatically. Add a second category, `Steel`, for the direct-count item later.
4. **Items → Add Item**, four times, all in the `Concrete Materials` category, all **Norm Based**:

   | Name | UOM |
   |---|---|
   | Cement | MT |
   | 10mm Aggregate | MT |
   | 20mm Aggregate | MT |
   | River Sand | MT |

   *Norm Based* means: consumption is checked against how much concrete was actually produced, using a recipe (mix ratio) — this is for materials where "how much should have been used" depends on a formula.
5. Add a fifth item, `TMT Steel Bars`, category `Steel`, UOM `MT`, Reconciliation Type **Direct Count**. *Direct Count* means simpler: what the books say you have vs. what you actually counted, no formula involved — this item exists in the walkthrough to prove the two calculation types coexist cleanly on the same statement.
6. **Company Defaults → Add Default**, once per Norm Based item (four times), giving each a **blank-grade** (company-wide) fallback rate/mix ratio. This is the number used if a specific concrete grade has no grade-specific entry of its own:

   | Item | Rate (₹/MT) | Mix Ratio (blank grade) |
   |---|---|---|
   | Cement | 6500 | 0.30 |
   | 10mm Aggregate | 653 | 1.10 |
   | 20mm Aggregate | 868 | 1.10 |
   | River Sand | 198 | 1.10 |

   Leave Effective From at today's date, leave Grade blank on all four.
7. Now add **grade-specific overrides** for two concrete grades, **M10** and **M30**, so the walkthrough exercises the pivoted Design Mix table properly. Still in **Company Defaults → Add Default**, this time filling in the **Grade** field:

   | Item | Grade | Rate (₹/MT) | Mix Ratio |
   |---|---|---|---|
   | Cement | M10 | 6500 | 0.2200 |
   | Cement | M30 | 6500 | 0.4380 |
   | 10mm Aggregate | M10 | 653 | 0.5280 |
   | 10mm Aggregate | M30 | 653 | 0.4620 |
   | 20mm Aggregate | M10 | 868 | 0.5920 |
   | 20mm Aggregate | M30 | 868 | 0.6930 |
   | River Sand | M10 | 198 | 0.6600 |
   | River Sand | M30 | 198 | 0.5970 |

   When production output is later logged against grade M10, these M10 rows are used instead of the blank-grade default; M30 output uses the M30 rows. A grade with no matching row at all falls back to the blank-grade default from step 6.
8. Also add a **Company Default** for `TMT Steel Bars`: Rate `58000`, no Mix Ratio field (Direct Count items never show one).
9. *(Optional)* **Site Overrides → Add Override** — pick a specific site and give it its own rate/mix ratio if that site has a different contracted price. Skip this for the walkthrough; the company defaults are enough to test with.
10. *(Optional)* **Tolerance Settings** — controls how big a variance has to be before it's flagged Watch or Over Tolerance. The default (2%, with anything past 1.5× that becoming Over Tolerance) is fine to leave as-is.

**Adding your own items later:** the exact same three steps — Item Category (if it's a new group), Item, Company Default (with grade rows if the rate/mix ratio genuinely differs by output grade) — apply to any material you add, whether that's 1 more or 20 more. There's nothing item-count-specific anywhere else in the system; Monthly Entry, the statement, and the reports all just show one more row/column automatically.

**What to check:** all five items, both categories, and all defaults (four blank-grade + eight grade-specific + one steel) show up in their respective lists; Store HO will be able to see every item once it's active, for whichever site it's entering data for.

---

## Part 2 — Store HO enters the month

You need a **Store HO** account (Admin → User Management → Add Employee, role **Store HO**) and a **Director** account (role **Director**) so there's someone to route the submission to.

1. **Log in as Store HO.** Sidebar: **Dashboard, Monthly Entry, Reports, Settings**.
2. Open **Monthly Entry**. Pick the **Site** you're entering data for from the dropdown (there is no automatic "your site" — every month's entry starts with choosing which site), then the month (defaults to the current month).
3. *(Optional)* Fill in **Opening Stock Date** and **Closing Stock Date** on the status card — the physical count dates for this month, shown later on the printed statement. Leave blank if you don't track this.
4. **Production Output** — for Norm Based items only. Add two batches, one per grade, so the pivoted Design Mix/Theoretical Consumption sections have two grade columns to show:
   - Item `Cement`, Grade `M10`, Output Quantity `5`. **Add Output**.
   - Item `Cement`, Grade `M30`, Output Quantity `21`. **Add Output**.
   - Repeat both grades for `10mm Aggregate`, `20mm Aggregate`, and `River Sand` too (same `5` / `21` quantities — in real use each material's own batch quantity should match the actual concrete volume produced under that grade this month).
5. **Reconciliation Entries** — one row per item. Fill in each Norm Based item's opening/receipts/closing:

   | Item | Opening | Receipts | Closing |
   |---|---|---|---|
   | Cement | 5.95 | 20.00 | 52.80 |
   | 10mm Aggregate | 61.50 | 28.05 | 66.00 |
   | 20mm Aggregate | 184.00 | 65.84 | 246.00 |
   | River Sand | 0 | 0 | 90.00 |

   For `TMT Steel Bars` (Direct Count), fill in **Book Stock** and **Physical Count** instead — there's no Opening/Receipts/Closing for this row type. Try Book Stock `12`, Physical Count `11.5` (a small, expected variance).

   **Section / Rack** is optional on every row — just where it's physically stored (e.g. "Section A" / "Rack 3"); leave blank if you don't track this.
6. Click **Save** on each row. Each one computes **Actual**, **Theoretical**, **Variance**, and a status chip (Within Tolerance / Watch / Over Tolerance). Any nonzero variance or difference figure shows in **red**, whether it's over or under — not just negative ones. Cement and River Sand should come out negative here (closing stock exceeds opening + receipts, an intentionally "wrong" number to prove the red styling and the flagging engine both fire) — check both actually render red.
7. Click **Print Statement** to see the formatted document — see Part 5 for what each section means.
8. Click **Export CSV** next to it for a plain-data download of the same statement (see Part 5 for what's in it).
9. Once you're happy with the numbers, click **Submit Period**. The status flips to **Pending Approval**, a banner shows *"Awaiting approval — Director: \<name\>"*, and the page becomes read-only — you can't edit it anymore unless the Director sends it back or someone reopens it.
10. To enter a **different site's** month, just change the Site dropdown at the top and repeat — one Store HO account handles every site, one at a time.

**What to check:** a Direct Count item's row only asks for Book Stock / Physical Count (no opening/receipts/closing); Submit is disabled with no entries at all; once submitted, every input on the page (including the stock-date fields) is locked; switching the Site dropdown loads that site's own month independently of any other site's data; every variance/difference figure that isn't exactly zero is red, in both the entry rows and the printed statement.

---

## Part 3 — Approving the month

There's only one approval level: **the Director.** Store HO prepares and submits but never approves — not even its own submission; there's no "Approvals" section in the Store HO portal at all, and the backend rejects the request even if you try it directly. Admin/Super Admin keep a standing override, so they can also act on a pending month if needed, but the normal path is Director alone.

### As Director

1. Log in as Director. Sidebar has a **Reconciliation Approvals** entry (separate from the Director's other, unrelated "Approval Inbox" for correction requests).
2. Open it — every currently-submitted period shows up here, across every site, with who submitted it and how many entries/flags it has. Three choices:
   - **Approve** (no comment needed) — the period becomes **Approved** and is permanently locked; no one can edit its entries again.
   - **Return For Correction** (comment required) — sends it back to **Draft** with your note. Store HO sees exactly why, fixes the numbers, and resubmits — this starts a fresh approval round, but the old round stays on record.
   - **Reject** (comment required) — a harder stop than Return, for "this whole submission is invalid." The period becomes permanently **Rejected** and locked — unless someone reopens it (see below).
3. For the walkthrough, click **Approve**. The period is now **Approved**.

### As Admin (the override)

Admin doesn't need to wait for a turn — they can act on any currently-pending period too, from **Store Reconciliation → Approval Inbox**. This exists as a safety net (e.g. the Director is unavailable), not the everyday path.

**What to check:** Store HO has no Approvals link anywhere and gets a 403 if it hits the API directly (confirm by trying to open `/store/approvals` directly — it 404s, the route doesn't even exist); Reject requires a comment, Approve doesn't; only one level exists — approving a submission finalizes it immediately, there's no "advances to the next level" step to watch for.

### Reopening a rejected period

Reject is meant to be a hard stop, but mistakes happen.

1. As **Store HO**, **Director**, or **Admin**, find the rejected period (Store HO: Monthly Entry, pick that site/month). A **Rejected** status banner shows the reason and a **Reopen For Correction** button (visible to Store HO on Monthly Entry).
2. Click it. The period goes back to **Draft** — Store HO gets notified and can edit and resubmit. The original rejected round's history is kept, not erased; a resubmission starts a new round, back through the Director again.

---

## Part 4 — Reports and dashboards

For Director, Store HO, and Admin — read-only, cross-site.

1. Open **Variance Reports** (Director: "Store Reconciliation" in the sidebar; Store HO: "Reports"; Admin: the "Variance Reports" tile on the Store Reconciliation dashboard).
2. The month picker defaults to the most recent month with any data.
3. **KPI row** — seven cards:
   - **Sites Reporting** — how many sites have reported this month, out of the total active sites.
   - **Total Entries** — count of reconciliation entries across every site this month.
   - **Over Tolerance**, **Watch**, **Within Tolerance** — the three-way status breakdown.
   - **Total Variance Value** — the rupee sum of every entry's variance this month, company-wide; turns red/error-toned if nonzero.
   - **Largest Single Variance** — the single worst site's total variance value, so you can spot the outlier without reading the whole leaderboard.
4. **6-Month Trend**: a stacked bar chart, one bar per month, showing whether things are getting better or worse over time.
5. **Site Leaderboard**: every site that's reported this month, worst-first (most Over Tolerance entries, then Watch, then biggest rupee variance). Click **Export CSV** above the table for a raw-data download of the same ranking.
6. **Item Leaderboard**: the same idea, but per material — plus a "Sites Affected" count telling you whether a bad reading is one site's mistake or a company-wide pattern (e.g. a wrong mix ratio). Also has its own **Export CSV**.
7. Click **Print Report** for a clean, print-ready version (sidebar/buttons hidden, just the data).

---

## Part 5 — Statements: reading every section, single-site and multi-site

**Single-site statement** (Store HO): open Monthly Entry for a site/month that has data, click **Print Statement**. A formatted document appears in the print preview, laid out as a *pivot* — materials/grades run across the columns, not down separate per-item tables, matching how a site engineer would actually read a reconciliation sheet:

- **Header block**: site, assessment month, opening/closing stock dates (if set), status.
- **1. Stock & Receipts (Actual Consumption)** — one column per item, four rows: Opening Stock/Book Stock, Add: Receipts/Physical Count, Less: Closing Stock, and **Net Consumption (Actual)** in bold (red if negative).
- **2. Production Output & Approved Design Mix** — one column per grade produced this period, plus a Total column. First row is **Quantity Produced** per grade; below that, one row per material showing its configured Design Mix ratio for each grade ("Not configured" if a grade was produced but that material has no rate/mix ratio set for it — a real data-quality gap worth fixing in Part 1; "–" if that material simply has no batch logged under that grade at all).
- **3. Theoretical Consumption (Production × Design Mix)** — this is the section that makes the "Theoretical" number in Section 4 traceable instead of a black box. Same grade columns as Section 2; each cell is literally *Quantity Produced for that grade × that material's Design Mix ratio for that grade*. The Total column is the exact figure used in Section 4's comparison — check that it lines up (in the worked example, Cement's Total should read 10.30 MT: `5×0.22 + 21×0.438`).
- **4. Final Analysis (Actual vs Theoretical)** — one row per item: Actual, Theoretical/Book, Difference, Difference %, Rate, Difference Value (₹), all nonzero variance/difference figures in red, with a **TOTAL VARIANCE VALUE** row at the bottom. A note under the heading spells out exactly what "Theoretical" means here: the Section 3 total for materials with production output recorded, or simply the Book Stock figure from Section 1 for Direct Count items (like `TMT Steel Bars`, which has no design mix at all).

Click **Export CSV** next to Print Statement for a plain per-item CSV of the same four sections — useful for pulling into a spreadsheet, but it's a flat data export, not a pivoted copy of the printed layout.

**Multi-site pack** (Director/Store HO/Admin, all three portals): open **Multi-Site Statement Pack** (linked from the Reports page, or its own tile/route in each portal). By default, every site that reported this month gets its own full statement (all four sections above), one after another, each starting on a new printed page. Use the **Site** dropdown next to the month picker to narrow it down to just one site if you don't want every site in the pack. **Print Pack** gives the same clean print view; **Export CSV** gives every site's statement concatenated into one CSV, blank-line separated.

---

## Part 6 — Working offline (Store HO)

Monthly Entry is built to survive a flaky connection while you're mid-count.

1. Open Monthly Entry normally, with a connection, site selected.
2. Turn off your device's Wi-Fi/data (or use your browser's network-throttling "Offline" preset for a controlled test).
3. A red banner appears: *"You're offline — changes will be saved on this device and sent when you're back online."*
4. Fill in a row and click Save. No error — the row shows a **Queued** badge instead of a computed variance (there's no way to compute the real variance without reaching the server), but your typed numbers stay visible.
5. Reconnect. Within a couple of seconds the banner disappears and the row updates itself with the real computed figures — proof the save actually reached the server.

There's a second, separate kind of offline behavior: if you've *already opened* a given site/month on this device before (even once, while online), and you lose connectivity and revisit it, it'll show you the last data it saved instead of erroring, with a small note: *"Showing a saved copy"* and when it was saved. This does **not** work for a site/month you've genuinely never opened before on this device — that still needs a real connection the first time.

**What doesn't work offline, on purpose:** Submit Period, the CSV bulk-import, CSV export, and every approval action (Approve/Return/Reject/Reopen) all require connectivity and say so plainly rather than silently failing.

---

## A complete worked example, start to finish

Putting it all together with the five-item scenario from Part 1:

1. **Admin** creates category `Concrete Materials` (Cement, 10mm Aggregate, 20mm Aggregate, River Sand — all Norm Based) and `Steel` (`TMT Steel Bars`, Direct Count), plus company defaults for all five, with grade-specific M10/M30 rows for the four concrete materials, per the tables in Part 1.
2. **Store HO** picks a site from the dropdown on Monthly Entry, sets Opening/Closing Stock Dates, logs production output of `5` (grade M10) and `21` (grade M30) for each of the four concrete materials, then fills in the Reconciliation Entries table per Part 2's numbers. Clicks **Submit Period**.
3. **Director** opens Reconciliation Approvals, sees the submission with **Current level: Director**, clicks **Approve** → period is now **Approved**, locked.
4. **Store HO** switches the Site dropdown to a second site and repeats step 2 for that site's month — same account, no new login.
5. **Director/Store HO/Admin** opens Variance Reports, sees both sites in the Site Leaderboard and all five items in the Item Leaderboard, checks the 6-Month Trend, exports both leaderboards to CSV.
6. Anyone with reporting access opens the **Multi-Site Statement Pack**, sees both sites' statements (or filters the Site dropdown down to just one), clicks **Print Pack**, then **Export CSV**.

To see the *approval variations* instead of the straight-through path, redo step 3 three different ways on three separate test months:
- Director clicks **Return For Correction** with a comment → Store HO sees it back in **Draft** with the comment, fixes it, resubmits (round 2 starts).
- Director clicks **Reject** with a comment → period is **Rejected** and locked; then Store HO (or Director, or Admin) clicks **Reopen For Correction** → back to **Draft**, Store HO resubmits.
- Instead of Director approving, **Admin** opens their own Approval Inbox and approves the Director-assigned step directly → confirms the override works.

---

## Quick troubleshooting

- **"No active Director is configured"** on Submit — you need at least one active Director account before any period can be submitted.
- **Store HO can't see an item** — check it's active (not deactivated) in the masters.
- **Mix ratio field won't appear** when adding a company default/site override — only shows for Norm Based items; Direct Count items don't use one.
- **A Design Mix cell says "Not configured"** on the printed statement — that grade was produced (there's an output batch for it) but that specific material has no rate/mix ratio row for that grade *and* no blank-grade fallback either; add one in Part 1's Company Defaults.
- **A Design Mix cell says "–"** instead — that material simply has no production batch logged under that grade this period; not an error, just nothing to show.
- **Store HO can't reach Settings** — check the role is exactly `STORE_HO`; the Settings section is Store-HO-only.
- **Nothing shows on Reports/Statement Pack** — the month picker may be pointing at a month with no submitted data, or the Site filter (on the statement pack) is narrowed to a site with nothing that month; change either, or confirm at least one site has entries for that month.
- **Looking for a "Store User" role** — it doesn't exist. One Store HO account enters every site's data by picking the site from a dropdown on Monthly Entry.
