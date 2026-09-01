# Store Reconciliation — Complete Testing Guide

A plain-language, step-by-step walkthrough of the whole Store Reconciliation module: who does what, how to set it up with a realistic multi-material item list, how to enter and submit a month (including logging one product's output at a grade, then recording several materials' actual consumption against that exact grade), how it gets approved, and how to read every section of the reports and statements. Written for testing, not for developers — no code, just clicks, in order, with one worked example running all the way through.

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

"Masters" means: what items exist, what they cost, and — for a manufactured product like concrete where you can't just count bags — what recipe (mix ratio) turns production into expected consumption. Do this once per item; it's reused every month after. This part sets up **one product and five materials** so the worked example below exercises grade-specific entries, the pivoted statement layout, and a material with no recipe at all.

Either an **Admin** or the **Store HO** can do this whole part. Admin uses the sidebar's **Store Reconciliation** entry; Store HO uses **Settings** in their own sidebar. Same screens either way.

1. **Log in** as Admin (or Store HO) at `http://localhost:5173/admin/login`.
2. Open **Store Reconciliation** (Admin) or **Settings** (Store HO). You land on an overview with counters — Item Categories, Items, Company Defaults, Site Overrides — all zero on a fresh setup.
3. **Item Categories → Add Category.** Name it `Concrete Materials` and check **Is Production Type**. This one checkbox is what makes a category a *product* — the system will offer it on Monthly Entry's Production Output form, and every Item you assign to this category automatically becomes one of its recipe materials. There's no separate "assign this item to the recipe" step; being in the category *is* being in the recipe. Once checked, a **Grades** field appears — add `M10` and `M30` as chips (type each, click Add Grade), matching the two grades this walkthrough produces. This is the *only* place grades are ever typed freely; everywhere else - Production Output, Company Defaults, Site Overrides - picks from this same list via a dropdown, so a grade can never be mistyped ("M20" vs "m20" vs "M-20") once it's here. Add a second category, `Steel`, and leave **Is Production Type** unchecked (no Grades field appears) — it's a plain material grouping, not something anyone produces.
4. **Items → Add Item**, four times, checking `Concrete Materials` in **Categories** each time, all **Norm Based**. Categories is a checkbox list, not a single dropdown — a material shared across more than one product (e.g. Water used in both Concrete and Mortar) gets created **once** and checked under every category it belongs to, instead of being recreated per category:

   | Name | UOM |
   |---|---|
   | Cement | MT |
   | 10mm Aggregate | MT |
   | 20mm Aggregate | MT |
   | River Sand | MT |

   *Norm Based* means: consumption is checked against how much concrete was actually produced, using a recipe (mix ratio) — this is for materials where "how much should have been used" depends on a formula. Because `Concrete Materials` is a Production Type category, these four automatically show up as Concrete's recipe — check the item list's **Category** column reads `Concrete Materials` for all four and nothing else needs setting.
5. Add a fifth item, `TMT Steel Bars`, category `Steel`, UOM `MT`, Reconciliation Type **Direct Count**. *Direct Count* means simpler: what the books say you have vs. what you actually counted, no formula involved. Because `Steel` isn't a Production Type category, this item will never appear inside a product's expanded panel — it gets entered on its own, standalone.
6. **Company Defaults → Add Default**, once per Norm Based item (four times), giving each a **blank-grade** (company-wide) fallback rate/mix ratio. This is the number used if a specific concrete grade has no grade-specific entry of its own:

   | Item | Rate (₹/MT) | Mix Ratio (blank grade) |
   |---|---|---|
   | Cement | 6500 | 0.30 |
   | 10mm Aggregate | 653 | 1.10 |
   | 20mm Aggregate | 868 | 1.10 |
   | River Sand | 198 | 1.10 |

   Leave Effective From at today's date, leave Grade blank on all four.
7. Now add **grade-specific overrides** for two concrete grades, **M10** and **M30**, so the walkthrough exercises the per-grade entry feature and the pivoted Design Mix table properly. Still in **Company Defaults → Add Default**, this time picking the **Grade** dropdown instead of leaving it on "Every grade" — it only ever offers the grades configured on that item's own category in step 3, so there's nothing to mistype:

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

   When Concrete's production output is later logged at grade M10, these M10 rows are used instead of the blank-grade default; M30 output uses the M30 rows. A grade with no matching row at all falls back to the blank-grade default from step 6.
8. Also add a **Company Default** for `TMT Steel Bars`: Rate `58000`, no Mix Ratio field (Direct Count items never show one).
9. *(Optional)* **Site Overrides → Add Override** — pick a specific site and give it its own rate/mix ratio if that site has a different contracted price, either standing or for one month only. Skip this for the walkthrough; the company defaults are enough to test with. **This also decides which item a site sees for a shared product**: if two materials in the same category serve the same role at different sites (e.g. Site A uses Loose Cement for M20, Site B uses Cement OPC for the same M20), give each site its own override naming *its* material — once a site has at least one configured item in a category, Monthly Entry's expanded panel for that site narrows to only its configured items, so the other site's material stops showing up there. A site with no overrides in a category still sees every item in it, unrestricted.
10. *(Optional)* **Tolerance Settings** — controls how big a variance has to be before it's flagged Watch or Over Tolerance. The default (2%, with anything past 1.5× that becoming Over Tolerance) is fine to leave as-is.
11. Every master row (categories, items, company defaults, site overrides) can be **permanently deleted**, not just deactivated — a red trash icon sits next to the existing activate/deactivate toggle on each list. This is for cleaning up sample/mistaken rows: deleting something still in real use (it has a company default, a site override, or a saved entry pointing at it) is refused with a message naming what's blocking it; deactivate that one instead. Nothing already referenced by real data can be lost this way.

**Adding your own product/materials later:** the same pattern applies to anything you produce — one Production Type category per product, the materials that go into it as Items assigned to that category, then Company Defaults for rate/mix ratio (with grade rows if the ratio genuinely varies by output grade). Anything with no recipe of its own (nuts, bolts, safety gear, TMT bars) just goes in a category that is *not* flagged Production Type, and gets entered directly instead of through a product's panel.

**What to check:** both categories, all five items, and all defaults (four blank-grade + eight grade-specific + one steel) show up in their respective lists; the Item list's Category column correctly groups the four concrete materials under `Concrete Materials`; Store HO will be able to see every item once it's active, for whichever site it's entering data for. Try checking a second category on Cement (e.g. `Steel`, just to see it work) and confirm it now appears inside *both* categories' Production Output panels and the Category column shows both codes — then uncheck it again, since Cement genuinely only belongs to Concrete Materials for the rest of this walkthrough.

---

## Part 2 — Store HO enters the month

You need a **Store HO** account (Admin → User Management → Add Employee, role **Store HO**) and a **Director** account (role **Director**) so there's someone to route the submission to.

1. **Log in as Store HO.** Sidebar: **Dashboard, Monthly Entry, Reports, Settings**.
2. Open **Monthly Entry**. Pick the **Site** you're entering data for from the dropdown (there is no automatic "your site" — every month's entry starts with choosing which site), then the month (defaults to the current month).
3. *(Optional)* Fill in **Opening Stock Date** and **Closing Stock Date** on the status card — the physical count dates for this month, shown later on the printed statement. Leave blank if you don't track this.
4. **Production Output** — this is where you log what was actually made, once per grade, for the *product* itself (never per material — one Concrete batch automatically feeds every one of its recipe materials' theoretical consumption). The form is a single line: **Product**, **Grade**, **Output Quantity**, **Add Output**. Grade is a dropdown, not free text — it only ever lists the grades configured on the selected product's category (Part 1, step 3), so a batch can never be logged against a grade nothing else recognizes. Add two batches:
   - Product `Concrete Materials`, Grade `M10`, Output Quantity `5`. **Add Output**.
   - Product `Concrete Materials`, Grade `M30`, Output Quantity `21`. **Add Output**.

   That's the entire production-logging step — two rows, not eight. You do **not** log a separate batch per material; the batch belongs to the product, and every material assigned to that category reads its theoretical consumption off it automatically, for its own exact grade.
5. Both batches now show as rows in a table (Product / Grade / Quantity / Actions), each with a chevron on the left. **Click the M10 row** to expand it. This reveals a nested panel scoped to *exactly this grade*:
   - A single-line "add a material" form, with a read-only **Grade: M10** badge next to the Item picker — you can't accidentally log a material's actual consumption against the wrong grade, because the grade isn't something you type, it's inherited from the row you expanded.
   - A table of whatever's already been entered for this grade (empty at first).

   Add all four concrete materials' actual consumption for M10:

   | Item | Opening | Receipts | Closing | Actual | Theoretical | Result |
   |---|---|---|---|---|---|---|
   | Cement | 1.00 | 0.10 | 0.00 | 1.10 | 1.10 (5 × 0.2200) | exact match, green |
   | 10mm Aggregate | 2.00 | 0.64 | 0.00 | 2.64 | 2.64 (5 × 0.5280) | exact match, green |
   | 20mm Aggregate | 2.50 | 0.46 | 0.00 | 2.96 | 2.96 (5 × 0.5920) | exact match, green |
   | River Sand | 3.00 | 0.30 | 0.00 | 3.30 | 3.30 (5 × 0.6600) | exact match, green |

6. Click the M10 row again to collapse it, then **click the M30 row** to expand it instead. Its own Grade badge now reads **M30**, and its materials table starts empty again — M10's entries don't show up here, because they belong to a different grade. Add the same four materials' actual consumption for M30, this time with one deliberately wrong number to prove the flagging/red-styling still works:

   | Item | Opening | Receipts | Closing | Actual | Theoretical | Result |
   |---|---|---|---|---|---|---|
   | Cement | 5.00 | 20.00 | 15.00 | 10.00 | 9.198 (21 × 0.4380) | **over-consumed — red, Over Tolerance flag** |
   | 10mm Aggregate | 60.00 | 9.702 | 60.00 | 9.702 | 9.702 (21 × 0.4620) | exact match, green |
   | 20mm Aggregate | 180.00 | 14.553 | 180.00 | 14.553 | 14.553 (21 × 0.6930) | exact match, green |
   | River Sand | 0.00 | 12.537 | 0.00 | 12.537 | 12.537 (21 × 0.5970) | exact match, green |

   Cement now has **two separate entries** — one for M10, one for M30 — each with its own opening/receipts/closing and its own computed actual/theoretical/variance. This is the key behavior to check here: the same material can carry more than one entry in the same period, one per grade actually produced, instead of being forced into a single blended number.
7. For `TMT Steel Bars` — not in a Production Type category, so it never appears inside a product's panel. It lives in its own **Other Items** card further down the page (same single-line add form). Fill in **Book Stock** `12`, **Physical Count** `11.5` — a small shortfall, but at ~4.2% of book stock it's still enough to cross the default 3% Over Tolerance threshold, so expect this row to flag too, alongside Cement/M30. There's no Opening/Receipts/Closing for this row type, and no grade either.

   **Section / Rack** is optional on every row — just where it's physically stored (e.g. "Section A" / "Rack 3"); leave blank if you don't track this.
8. Click **Save** on each row as you go. Each one computes **Actual**, **Theoretical**, **Variance**, and a status chip (Within Tolerance / Watch / Over Tolerance) as soon as you save it. Any nonzero variance/difference figure shows in **red** if it's a loss (over-consumption, or a physical shortfall) and **green** if it's a saving — not just a flat "nonzero = red" rule. The Cement/M30 row above should come out red; everything else should be green or neutral.
9. Scroll down to the **Reconciliation Entries** card — a read-only summary of every entry recorded this period, across every grade, all in one table with no horizontal scrolling. It now includes a **Grade** column, since Cement has two rows (`M10` and `M30`) here that both say `Cement` but a different grade each. Each row's Quantities and Result are shown as small stacked figures inside one cell rather than spread across many columns — everything is still there, just laid out to fit one screen width instead of needing to scroll sideways.
10. Click **Print Statement** to see the formatted document — see Part 5 for what each section means.
11. Click **Export CSV** next to it for a plain-data download of the same statement (see Part 5 for what's in it).
12. Once you're happy with the numbers, click **Submit Period**. The status flips to **Pending Approval**, a banner shows *"Awaiting approval — Director: \<name\>"*, and the page becomes read-only — you can't edit it anymore unless the Director sends it back or someone reopens it.
13. To enter a **different site's** month, just change the Site dropdown at the top and repeat — one Store HO account handles every site, one at a time.

**What to check:** the Production Output form offers only Production Type categories (Concrete Materials, not Steel) as a Product; expanding one output row's chevron shows a Grade badge matching that exact row and a materials list scoped to that category only; the same material (Cement) can be added again under a different grade's expanded panel without being blocked as "already entered"; editing a saved entry never lets you change its grade (it's fixed at creation, matching how the Item itself can't be changed either); a Direct Count item's row only asks for Book Stock / Physical Count (no opening/receipts/closing, no grade); Submit is disabled with no entries at all; once submitted, every input on the page (including the stock-date fields) is locked; switching the Site dropdown loads that site's own month independently of any other site's data; the bottom summary table needs no horizontal scrolling at any point in this walkthrough.

---

## Part 3 — Approving the month

There's only one approval level: **the Director.** Store HO prepares and submits but never approves — not even its own submission; there's no "Approvals" section in the Store HO portal at all, and the backend rejects the request even if you try it directly. Admin/Super Admin keep a standing override, so they can also act on a pending month if needed, but the normal path is Director alone.

### As Director

1. Log in as Director. Sidebar has a **Reconciliation Approvals** entry (separate from the Director's other, unrelated "Approval Inbox" for correction requests).
2. Open it — every currently-submitted period shows up here, across every site, with who submitted it and how many entries/flags it has. Three choices, right on the inbox card:
   - **Approve** (no comment needed) — the period becomes **Approved** and is permanently locked; no one can edit its entries again.
   - **Return For Correction** (comment required) — sends it back to **Draft** with your note. Store HO sees exactly why, fixes the numbers, and resubmits — this starts a fresh approval round, but the old round stays on record.
   - **Reject** (comment required) — a harder stop than Return, for "this whole submission is invalid." The period becomes permanently **Rejected** and locked — unless someone reopens it (see below).
3. **Click View Entries first** to actually look at the numbers before deciding — it opens the same read-only Monthly Entry page Store HO used, and the **same Approve / Return For Correction / Reject controls (with the comment box) are right there too**, directly under the status banner. Acting from here takes effect immediately and updates the banner in place - there's no need to go back to the inbox to approve what you just reviewed.
4. For the walkthrough, click **Approve** (from either screen). The period is now **Approved**. The inbox card shows this submission's real numbers as you built it — **Entries: 9, Flags: 2** (Cement/M30's over-consumption and the Steel shortfall) — and neither flag blocks approval; flags are informational, not a hard gate. The Director decides whether an explained variance is acceptable.

### As Admin (the override)

Admin doesn't need to wait for a turn — they can act on any currently-pending period too, from **Store Reconciliation → Approval Inbox**. This exists as a safety net (e.g. the Director is unavailable), not the everyday path.

**What to check:** Store HO has no Approvals link anywhere and gets a 403 if it hits the API directly (confirm by trying to open `/store/approvals` directly — it 404s, the route doesn't even exist); Reject requires a comment, Approve doesn't; only one level exists — approving a submission finalizes it immediately, there's no "advances to the next level" step to watch for; the approval controls on View Entries only show up for Director/Admin while a period is Pending Approval, and disappear immediately once it's acted on (the page re-reads the period's new status, it isn't just hidden).

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
   - **Total Entries** — count of reconciliation entries across every site this month (each grade-specific entry counts separately — Cement/M10 and Cement/M30 from the walkthrough above count as two).
   - **Over Tolerance**, **Watch**, **Within Tolerance** — the three-way status breakdown.
   - **Total Variance Value** — the rupee sum of every entry's variance this month, company-wide (a signed profit/loss figure); turns red/error-toned if it nets to a loss.
   - **Largest Single Variance** — the single worst site's total variance value, so you can spot the outlier without reading the whole leaderboard.
4. **6-Month Trend**: a stacked bar chart, one bar per month, showing whether things are getting better or worse over time.
5. **Site-wise Variance (₹)**: a bar chart, one bar per reporting site, colored green for a net saving and red for a net loss at that site — the quickest way to spot which site(s) are dragging the company total down.
6. **Site Leaderboard**: every site that's reported this month, worst-first (most Over Tolerance entries, then Watch, then biggest rupee variance). Click **Export CSV** above the table for a raw-data download of the same ranking.
7. **Item Leaderboard**: the same idea, but per material — plus a "Sites Affected" count telling you whether a bad reading is one site's mistake or a company-wide pattern (e.g. a wrong mix ratio). Also has its own **Export CSV**.
8. Click **Print Report** for a clean, print-ready version (sidebar/buttons hidden, just the data).

---

## Part 5 — Statements: reading every section, single-site and multi-site

**Single-site statement** (Store HO): open Monthly Entry for a site/month that has data, click **Print Statement**. A formatted document appears in the print preview, laid out as a *pivot* — materials/grades run across the columns, not down separate per-item tables, matching how a site engineer would actually read a reconciliation sheet. It has **three** sections:

- **Header block**: site, assessment month, opening/closing stock dates (if set), status.
- **1. Stock & Receipts (Actual Consumption)** — one column per *entry* (so a material with more than one grade this period, like Cement above, gets two columns: `Cement - M10` and `Cement - M30`), four rows: Opening Stock/Book Stock, Add: Receipts/Physical Count, Less: Closing Stock, and **Net Consumption (Actual)** in bold (red if negative).
- **2. Production Output & Approved Design Mix** — one column per grade produced this period, plus a Total column. First row is **Quantity Produced** per grade; below that, one row per *material* (not per entry — this section is deduplicated, since the design mix reference doesn't change depending on which grade's entry you're looking at) showing its configured Design Mix ratio for each grade ("Not configured" if a grade was produced but that material has no rate/mix ratio set for it — a real data-quality gap worth fixing in Part 1; "–" if that material simply has no batch logged under that grade at all).
- **3. Final Analysis (Actual vs Theoretical)** — one row per *entry* (again, two rows for Cement here — `Cement - M10` and `Cement - M30`, each with its own figures): Actual, Theoretical/Book, Difference, Difference %, Rate, Difference Value (₹), all nonzero variance/difference figures colored green (saving) or red (loss), with a **TOTAL VARIANCE VALUE** row at the bottom. A note under the heading spells out exactly what "Theoretical" means here: quantity produced × that material's Design Mix ratio from Section 2 for materials with production output recorded, or simply the Book Stock figure from Section 1 for Direct Count items (like `TMT Steel Bars`, which has no design mix at all). There's no separate "show the multiplication" table any more — Section 2 already carries the ratio, and this section's own Theoretical/Book figure is the one actually used for the comparison, so nothing is duplicated.

Click **Export CSV** next to Print Statement for a plain per-entry CSV of the same three sections — useful for pulling into a spreadsheet, but it's a flat data export, not a pivoted copy of the printed layout. It already only ever had three sections, so it now matches the printed statement's section count exactly.

**Multi-site pack** (Director/Store HO/Admin, all three portals): open **Multi-Site Statement Pack** (linked from the Reports page, or its own tile/route in each portal). By default, every site that reported this month gets its own full statement (all three sections above), one after another, each starting on a new printed page — it's the exact same statement component as the single-site view, so anything true of one is true of the other. Use the **Site** dropdown next to the month picker to narrow it down to just one site if you don't want every site in the pack. **Print Pack** gives the same clean print view; **Export CSV** gives every site's statement concatenated into one CSV, blank-line separated.

---

## Part 6 — Working offline (Store HO)

Monthly Entry is built to survive a flaky connection while you're mid-count.

1. Open Monthly Entry normally, with a connection, site selected.
2. Turn off your device's Wi-Fi/data (or use your browser's network-throttling "Offline" preset for a controlled test).
3. A red banner appears: *"You're offline — changes will be saved on this device and sent when you're back online."*
4. Fill in a row and click Save (works the same whether it's a fresh product-panel material entry, an Other Items entry, or a Production Output batch). No error — the row shows a **Queued** badge instead of a computed variance (there's no way to compute the real variance without reaching the server), but your typed numbers stay visible.
5. Reconnect. Within a couple of seconds the banner disappears and the row updates itself with the real computed figures — proof the save actually reached the server.

There's a second, separate kind of offline behavior: if you've *already opened* a given site/month on this device before (even once, while online), and you lose connectivity and revisit it, it'll show you the last data it saved instead of erroring, with a small note: *"Showing a saved copy"* and when it was saved. This does **not** work for a site/month you've genuinely never opened before on this device — that still needs a real connection the first time.

**What doesn't work offline, on purpose:** Submit Period, the CSV bulk-import, CSV export, and every approval action (Approve/Return/Reject/Reopen) all require connectivity and say so plainly rather than silently failing.

---

## A complete worked example, start to finish

Putting it all together with the scenario from Part 1:

1. **Admin** creates category `Concrete Materials` (checked as Production Type, with grades `M10` and `M30` added as chips) with Cement, 10mm Aggregate, 20mm Aggregate, River Sand assigned to it (all Norm Based), and `Steel` (unchecked, no grades field, holding `TMT Steel Bars`, Direct Count), plus company defaults for all five, picking the **Grade** dropdown (not typing it) for the grade-specific M10/M30 rows, per the tables in Part 1.
2. **Store HO** picks a site from the dropdown on Monthly Entry, sets Opening/Closing Stock Dates, logs **two** production batches — `Concrete Materials` / M10 / 5, and `Concrete Materials` / M30 / 21, choosing Grade from its dropdown both times — then expands each row in turn and fills in that grade's four materials' actual consumption per Part 2's tables (Cement ends up with two separate entries, one per grade). Fills in `TMT Steel Bars` in Other Items. Clicks **Submit Period**.
3. **Director** opens Reconciliation Approvals, sees the submission (Entries: 9, Flags: 2) with **Current level: Director**, clicks **View Entries** to check the numbers, then clicks **Approve** right there → period is now **Approved**, locked, despite the two Over Tolerance flags (Cement/M30, and the Steel shortfall).
4. **Store HO** switches the Site dropdown to a second site and repeats step 2 for that site's month — same account, no new login.
5. **Director/Store HO/Admin** opens Variance Reports, sees both sites in the Site-wise Variance chart and the Site Leaderboard, all five items in the Item Leaderboard, checks the 6-Month Trend, exports both leaderboards to CSV.
6. Anyone with reporting access opens the **Multi-Site Statement Pack**, sees both sites' statements (or filters the Site dropdown down to just one), clicks **Print Pack**, then **Export CSV**.

To see the *approval variations* instead of the straight-through path, redo step 3 three different ways on three separate test months:
- Director clicks **Return For Correction** with a comment → Store HO sees it back in **Draft** with the comment, fixes it, resubmits (round 2 starts).
- Director clicks **Reject** with a comment → period is **Rejected** and locked; then Store HO (or Director, or Admin) clicks **Reopen For Correction** → back to **Draft**, Store HO resubmits.
- Instead of Director approving, **Admin** opens their own Approval Inbox and approves the Director-assigned step directly → confirms the override works.

---

## Quick troubleshooting

- **"No active Director is configured"** on Submit — you need at least one active Director account before any period can be submitted.
- **Store HO can't see an item** — check it's active (not deactivated) in the masters.
- **Production Output's "Product" dropdown is empty, or my product isn't in it** — only categories with **Is Production Type** checked show up there; check that box on the category, not on the individual items.
- **Expanding a product's output row shows the wrong materials, or none at all** — the panel lists every Item that has that exact production-type category checked in its **Categories**; check each material's Categories checkboxes in Item Management (an item can have several checked, and shows in every one of those panels). If the material's category is right but it *still* doesn't show for this site, see the Site Overrides entry below.
- **A material that should be available for this site doesn't show up in a product's panel** — check Site Overrides for this site and category: once a site has at least one item configured there, only its configured items show, and the material you're expecting may simply not be one of them yet. Add a Site Override naming it, or remove/deactivate whichever override is narrowing the list if that wasn't intended.
- **I can't add a material again for a second grade** — check you expanded the *other grade's* output row first; each expanded panel's "already entered" check is scoped to its own exact grade, so a material entered for M10 should still be addable from M30's own panel.
- **I keep re-creating the same material for every grade/product** — you shouldn't have to. Categories on the Item form is a checkbox list, not a single dropdown; check every category a shared material like Cement or Water genuinely belongs to, once, instead of creating it again under each one.
- **Grade dropdown (Production Output, Company Defaults, Site Overrides) is empty or missing grades** — grades are configured once, on the item's category (Part 1, step 3), not typed at the point of use; add or fix them in Item Category Management and the dropdown updates everywhere that reads from it. When an item belongs to more than one category, the dropdown shows the *union* of every one of their grade lists.
- **Grade field is still free text instead of a dropdown** — that item's category has no grades configured yet; it stays lenient (free text) until at least one grade exists on the category, so older data isn't suddenly blocked.
- **Mix ratio field won't appear** when adding a company default/site override — only shows for Norm Based items; Direct Count items don't use one.
- **A Design Mix cell says "Not configured"** on the printed statement — that grade was produced (there's an output batch for it) but that specific material has no rate/mix ratio row for that grade *and* no blank-grade fallback either; add one in Part 1's Company Defaults.
- **A Design Mix cell says "–"** instead — that material simply has no production batch logged under that grade this period; not an error, just nothing to show.
- **Store HO can't reach Settings** — check the role is exactly `STORE_HO`; the Settings section is Store-HO-only.
- **Nothing shows on Reports/Statement Pack** — the month picker may be pointing at a month with no submitted data, or the Site filter (on the statement pack) is narrowed to a site with nothing that month; change either, or confirm at least one site has entries for that month.
- **Looking for a "Store User" role** — it doesn't exist. One Store HO account enters every site's data by picking the site from a dropdown on Monthly Entry.
- **Looking for a "Theoretical Consumption" table on the printed statement** — it was removed; Section 3 (Final Analysis) is now the statement's last section and already shows the Theoretical/Book figure actually used for the comparison, so nothing is missing, just no longer shown as a separate multiplication table.
- **Can't find a way to remove sample/test data** — every master (Item Categories, Items, Company Defaults, Site Overrides) has a red trash icon next to its activate/deactivate toggle for exactly this. It only refuses when the row is genuinely still in use elsewhere.
- **Delete says "still referenced by ... deactivate it instead"** — that row isn't unused; something real points at it (a company default, a site override, a saved entry). The message names what's blocking it. Deactivate it instead of deleting - it stops being offered anywhere new without losing that history.
