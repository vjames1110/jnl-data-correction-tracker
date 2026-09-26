# DPR & Bills and Costing — the complete guide

This is the end-to-end operating guide for **DPR & Bills** and **Costing** inside
Project Monitor: how to set a project's contract up, add its BOQ, record daily
progress, raise bills, and see the expense-vs-value picture in Costing. It is
written in the order you actually do the work, with one worked example carried
through from start to finish.

For just the *DPR-item-to-Costing* math (shorter, one worked example), see
[dpr-to-costing.md](dpr-to-costing.md) — that page is also linked as a
collapsible "How this works" note directly on the Costing screen.

## 1. Who does what

| Role | DPR & Bills | Costing |
|---|---|---|
| **Admin / Super Admin** | full access, every site | full access, every site |
| **Director** | view every site (read-only) | view every site (read-only) |
| **Project Management HO** | view every site + Overview edit rights | no access |
| **Project Incharge** | full access on their own site(s), automatically | no access |
| **Project Manager** | access only where an Admin has granted the **DPR & Bills** task on that site | no access |
| **HR / Machinery Department** | no access (their own HR / Machinery tabs only) | no access |

Costing is deliberately **Director/Admin only** — no per-site grant exists for
it at all, because project margin is more sensitive than progress or even
billing figures. If you are a Project Manager or Incharge and cannot see
Costing, that is correct, not a bug.

Grants are managed from **Admin → Project Monitor → Site Access** (pick a
site, tick the tasks each person holds).

## 2. Set the contract up first

Open **DPR & Bills** for a site and expand **Contract & billing details**
(Project Manager / Incharge / HO / Admin can edit it; Director only views it).

| Field | What it means |
|---|---|
| Contract / LOA no. | Your reference number for the award |
| Value as varied | Only if the contract value has been revised upward/downward from the original; leave blank to use the original |
| Tender % over the authority rate | The **contract-wide** percentage above (+) or below (−) the Railway's authority/estimated rate — see §3 |
| Billed before this system | The gross value already billed **before** you started using this app (so the running total starts correctly) |
| Last bill no. / date before this system | Which bill that opening figure came from |

> Changing the **Tender %** here re-works the bid rate of every item that has
> an authority rate (unless that item has its own percentage — see §3).
> **DPR entries and bills already recorded never change** — only new work
> uses the new rate. The screen tells you how many items were re-priced and
> how many existing entries are still on the old rate.

**Worked example — QA Doubling Project**
Original value ₹5,00,00,000. The tender was quoted **12% above** the
authority rates, so you set **Tender % = 12** here once, and every item that
has an authority rate is priced from it automatically.

## 3. Build the BOQ (Add item)

Click **Add item**. The form has four parts.

### Item
Item no. (e.g. `4.1`), description, unit, quantity.

### Position
Where the item sits:
- **Top level** (no group), or
- **under an existing group** (pick it from the list), or
- tick **"This is a group (heading)"** to create a group instead of an item.

A **group** has no quantity, rate or materials of its own — it only rolls up
the items placed under it. Groups nest **up to 3 levels deep**
(`4` → `4.1` → `4.1.1`). Only the lowest-level items take DPR entries,
measurements and bill lines — a group can never be entered against directly,
and its total in the grid is always the sum of what is under it, so nothing
is ever counted twice.

When you tick "This is a group", a **Sub-items** table appears so you can add
several items under it in one save — handy when you're keying in a whole BOQ
section at once. You can also add items to an existing group one at a time
later, using the **+** button on the group's row in the grid.

### Rates
- **Authority rate** — the Railway's estimated/schedule rate for this item.
- If you give an authority rate, a **Tender %** control appears, defaulting
  to the contract-wide percentage from §2. Tick **"Different % for this
  item"** only if this particular item was quoted at a different percentage.
- **Bid rate** is then calculated for you and shown live: `authority rate ×
  (1 + tender % ÷ 100)`. This is the rate the contractor is actually paid,
  and it is what everything downstream (DPR value, bills, Costing) reads.
- If you leave **Authority rate blank**, a plain **Contract rate** field
  appears instead — type the rate directly, exactly as before. Use this for
  items that were never quoted against a Railway schedule rate.

**Worked example**
Item **4.1 — RCC retaining wall**, unit cum, quantity 500, authority rate
₹12,500. With the contract-wide 12% above:

```
Bid rate = 12,500 × (1 + 12 / 100) = ₹14,000.00
```

The form shows this instantly as you type, so you can check it before saving.

### Materials
**Concrete per unit** (cum) and **TMT per unit** (kg) — how much of each
material one unit of this item consumes. This is the link Costing uses to
work out material cost (see §8). Leave both at 0 for an item that uses
neither (signage, minor civil work, etc.).

**Worked example (continued)**: the retaining wall uses **1 cum** of concrete
and **80 kg** of TMT per cum of wall.

### Importing a BOQ from Excel
Instead of typing items one by one, use **Import list** on the DPR grid.
Give it a file with columns for **Item no., Description, Unit, Qty**, and
any of **Authority rate**, **Tender %** (above/below) or **Quoted rate**
(if you only have the final quoted rate, the percentage is worked back from
it automatically). Rows nest into groups by their item number — a numbered
row with a description but no quantity/rate, that has other rows nested
under it, becomes a group automatically. Re-importing the same file changes
nothing (it matches by item no., else description), so it's safe to
re-upload a corrected file.

> **Note:** this import was built and tested against the column layout
> described above, not yet against a real Railway BOQ export. If your
> sheet's headers or layout differ, send a sample and it can be tuned to
> match exactly.

## 4. Escalation (only if your contract allows it)

Open **Contract & billing details → Escalation**. Add a step with:
- **Effective from** — the date the escalation starts.
- **Total escalation %** — the **total** percentage over the bid rate from
  that date (not an increment on the step before it — a later step fully
  replaces the earlier one).
- An optional note (e.g. the clause number).

**Worked example**: a step is added from **1 September** at **+5%**. From
that date, the wall's rate for new entries becomes:

```
Rate today = 14,000 × (1 + 5 / 100) = ₹14,700.00
```

Anything entered **before** 1 September stays at ₹14,000 — escalation, like
the tender %, only ever affects work recorded from that point on. Delete a
step to correct a mistake; it never touches history either.

## 5. Daily DPR entry

### The grid
**DPR grid** shows one row per item (groups shown bold with their roll-up),
one column per day — **today and the 3 days before it are editable**; older
days are locked (shown with a padlock) unless an Admin unlocks them with a
reason. Type the day's **total** quantity for an item and press **Save DPR**
— it only sends the cells you actually changed.

The grid is wide, so the Railway BOQ columns (Authority rate, Tender %,
Escalation, Rate today) are tucked behind the **Columns** chooser at the top
— tick the ones you want to see; your choice is remembered.

**Worked example**: type **10** in today's column for the retaining wall and
press Save DPR. If an escalation step is in force, the entry is priced at
₹14,700 (§4); if not, at ₹14,000.

### Detailed entries
Use the **Register** tab's entry form when you need to record a location,
agency or remarks alongside the quantity (not just a bare number in the
grid). Detailed entries are kept exactly as entered even when you later save
the grid for the same item/day — the grid's total simply fills in the
remainder above them.

### Uploading a filled DPR from Excel
**Template → Upload filled DPR** on the grid: columns are Date, Item no.,
Description, Unit, Qty done, Location/chainage, Agency, Remarks. Locked days
and unknown items are reported, not silently dropped, and re-uploading the
same file never creates duplicates.

### Unlocking an old day
Admin only, from the **Unlock day** panel: pick the site, date, and give a
reason (required, and logged). Director cannot unlock days.

## 6. The measurement sheet

The moment you type a quantity for an item (or click the small ruler icon
next to any day's cell), a **measurement sheet** opens directly under that
item's row. It's supporting detail for the number you typed — it never
blocks saving the DPR.

Add lines with:
- **Description/location** (e.g. "Wall between Ch 12+300 and 12+340")
- **Nos, L, B, D** — filled in as needed. Nos alone is a plain count;
  filling more than one multiplies them together (Nos × L × B × D, using
  only the ones you fill in).
- **Deduct** — tick this for an opening or overlap that should be subtracted.

The sheet totals the lines live and tells you how it compares with the
quantity you typed:

- *"Matches the 15 entered"*
- *"Measured 12.5 of 15 entered"* (measured less)
- *"Measured 17 - 2 more than the 15 entered"* (measured more)

**Use measured total** copies the sheet's total straight into the day's
quantity cell if you'd rather trust the measurement than a rounded figure —
you still have to press **Save DPR** afterwards to record it.

**Worked example**: two lines under the 10 cum entry —
`Nos 2, L 5.0, B 1.0` = 10.0. The chip reads *"Matches the 10 entered."*

The **Register** tab lists every day's measurement sheets underneath the
entry table, collapsible, and can be printed on its own.

## 7. RA Bills

Open the **RA bills** tab. Two kinds of bill:

### Item bill
Pick the items and the quantities being billed in this bill. The bill's
**gross** is always *computed* as Σ(quantity × the rate that was in force
when each quantity was billed) — it is never a number you type or that can
drift out of sync.

### Amount against project value
For a lump sum that isn't tied to any item or quantity (say an advance or a
price-variation payment). Enter just the **bill amount** — it reduces the
project's balance value the same way an item bill does, and by default is
recorded as **received in full on the bill date** (you can change the
received amount/date if it differs).

Every bill also records **Amount received** and **Received on**, so the
bills table shows Gross, Received and **Outstanding** (gross − received) per
bill.

**Worked example**: `RA-1`, dated 25 September, billing 10 cum of the wall.
Gross = 10 × ₹14,000 = ₹1,40,000 (using the rate in force before the
escalation step). Received ₹1,40,000 the same day → Outstanding ₹0.

## 8. Financial report and the Overview tiles

The **Financial report** tab (and the same tiles on **Overview**) shows the
money-aware contract status **as on** any date you pick:

| Tile | Meaning |
|---|---|
| Contract value | Original, or "as varied" if you set that in §2 |
| Done up to last bill | The last recorded (item) bill's cumulative billed value |
| DPR value after last bill | Value entered since that bill |
| Balance value | What's left of the contract value, and % done |
| Per day required | Balance ÷ days left on the contract |
| Executed yesterday | vs. per-day-required — flagged **on pace** or **short by ₹X** |
| Billed to date | Item bills + billed-before-this-system opening figure |
| Payments received | Everything actually received against bills recorded here |
| Outstanding | Billed but not yet received |

The item table below groups rows under their BOQ headings with a subtotal
per group, so a long BOQ still reads at a glance. **Print / Save as PDF**
gives a clean, printable copy.

## 9. Costing

Costing (Director/Admin only) has three workspaces.

### Rates & production
- **Material rates**: add a rate for **Concrete (per cum)** or **TMT steel
  (per MT)** with an effective-from date. The **latest rate on or before a
  given day** is the one used — so you can back-date or future-date a rate
  change and every past day still uses whatever was in force then.
- **DPR items and material use**: the same Concrete/TMT-per-unit fields from
  the item form, in one table, with the current rate and the resulting
  material cost and margin per unit — a quick way to spot an unlinked item
  ("No material usage set") or a material with no rate yet.
- **Concrete production (stores)**: if your stores team measures concrete
  production directly (grade, cum, cement/aggregate/sand/other cost), log it
  here for a day. **A stores figure for a day replaces the DPR-based
  estimate for that day — it is never added on top of it.**

### Cost table
One row per day: value of work done, expense (materials + HR + machinery),
margin, and a small completeness dot per feed (**D**PR / **H**R /
**M**achinery / **S**tores) so a day with a missing upload can't quietly
look like a great margin. Rows past **90% expense-to-value** are flagged.
Defaults to the last 30 days; pick any date range.

### Today at a glance
Pick a period — **Today, Yesterday, Last 7 days, Month to date, Last month,
Whole project**, or **Pick a date** — and see that period's value of work
done, total expense, margin, labour (on-site headcount for a single day, or
man-days for a range) and concrete, plus a note naming any day in the period
with nothing recorded for a feed.

### How the value ↔ expense chain works

```
value of work done   = DPR quantity × the item's rate (bid rate × escalation)
concrete cost        = DPR quantity × concrete-per-unit × concrete rate
                        (or the stores figure for that day, if any)
TMT cost              = DPR quantity × TMT-per-unit (kg) ÷ 1000 × TMT rate
expense               = concrete + TMT + HR (labour & staff) + machinery
margin                = value − expense
```

**Worked example, all the way through**: 10 cum of the retaining wall
entered on a day with no escalation yet, concrete rate ₹5,200/cum, TMT rate
₹62,000/MT, that day's HR cost ₹12,000 and machinery cost ₹6,400:

| | Working | Amount |
|---|---|---|
| Value of work done | 10 × 14,000 | ₹1,40,000 |
| Concrete cost | 10 × 1 × 5,200 | ₹52,000 |
| TMT cost | 10 × 80 kg = 0.8 MT × 62,000 | ₹49,600 |
| Labour & staff + machinery | from HR and Machinery | ₹18,400 |
| **Total expense** | | **₹1,20,000** |
| **Margin** | 1,40,000 − 1,20,000 | **₹20,000** |
| Expense / value | | 85.7% (not flagged — under 90%) |

If stores later logs ₹55,000 of concrete cost for that same day, the
concrete line becomes ₹55,000 (replacing, not adding to, the ₹52,000
estimate), expense becomes ₹1,23,000 and margin ₹17,000.

If the +5% escalation from §4 were in force that day instead, value becomes
10 × 14,700 = ₹1,47,000 and margin rises to ₹27,000 — **escalation changes
only the value side**, never the material cost.

## 10. Everyday checklist

**Setting a new project up**
1. Contract & billing details: value, LOA no., tender % if applicable.
2. Add the BOQ — groups first, then items (or import from Excel).
3. Set Concrete/TMT per unit on items that use them.
4. Costing → Rates & production: add the concrete and TMT rates.

**Every day**
1. Enter DPR quantities in the grid (add a measurement if useful).
2. Save DPR.
3. HR logs labour/staff cost; Machinery logs usage/fuel — someone with
   access to those tabs, not DPR & Bills.
4. When available, log the stores concrete figure.

**When a bill is due**
1. RA bills → Add bill → pick Item bill or Amount.
2. Record what's actually received, and when.
3. Check Outstanding.

**Periodically**
- Check the Financial report "as on" today for pace vs. the per-day
  required.
- Check Costing's Cost table for flagged days or missing-feed dots.
- Add an escalation step the day it becomes effective, not before.

## 11. Common questions

**Why can't I add a quantity to a row?** It's a group — enter it against the
items nested under it instead.

**I changed the tender % and a rate looks different now.** That's expected —
it re-worked every item priced from an authority rate. Already-recorded
entries and bills are untouched; the screen tells you how many were
re-priced and how many old entries still hold the earlier rate.

**An item shows "No material usage set" in Costing.** Its Concrete and TMT
per unit are both 0. Set them on the item if it should use one.

**A Costing row shows a missing-rate warning.** The item uses a material
that has no rate in force on that date — add one with an earlier
effective-from date.

**Can I edit a quantity from 20 days ago?** Only if an Admin unlocks that day
first, with a reason.

**Why can't the Director enter anything?** By design — Director is
read-only everywhere in Project Monitor, including DPR & Bills, Costing and
escalation.

**Why doesn't a Project Manager see DPR & Bills for a site?** They need the
**DPR & Bills** task granted for that specific site (Admin → Site Access). A
Project Incharge gets it automatically on their own site(s).
