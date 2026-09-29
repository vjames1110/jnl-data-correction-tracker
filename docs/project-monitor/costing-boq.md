# The Costing BOQ: authority rate, bid rate, our cost and profit/loss

**Costing > BOQ & Costing** is where item economics are worked out now - a
static profit/loss sheet, not a daily execution tracker. It replaces DPR &
Bills for this purpose: DPR & Bills stays in the app (nothing is deleted),
but quantities and billing are now the company ERP's job, so this sheet
never asks for a daily entry, a measurement, or a bill. Every number on it
is worked out live from each row's own quantity and rates, the moment you
open the page - change a rate and every total updates immediately.

## The three rates, on every row

| Rate | Meaning |
|---|---|
| **Authority rate** | The Railway/departmental estimated or schedule rate |
| **Bid rate** | What this row is actually worth - worked out from the authority rate, or typed by hand if there is no authority rate |
| **Our cost** | What this row actually costs us |

Bid rate minus Our cost is the **profit or loss** on that row, shown both
per unit and for the row's whole quantity.

## Materials are just rows, nested

There is no separate "materials" feature. A material is simply a BOQ row
with a parent - click the **+** beside "RCC retaining wall" to add "Supply
of cement" underneath it, exactly the same way you'd add a top-level item.
Nesting can go several levels deep.

Once a row has rows under it:
- Its **Our cost** is no longer typed - it becomes the sum of what its
  children cost. The wall's own "Our cost" field is ignored the moment it
  gets its first material.
- Its **own quantity, authority rate and bid rate stay independent** -
  those describe what the row itself is worth (billed to the client, or
  quoted by a supplier), never a rollup. A material's own qty × rate is
  never counted as contract revenue - only level-1 rows count toward the
  **Contract total** row at the bottom of the sheet.

### Worked example

"RCC retaining wall", qty 100 cum, authority rate ₹10,000, tender -10% →
bid rate ₹9,000/cum (bid amount ₹9,00,000 - this is what the client pays).

Two materials underneath it:

| | Qty | Our cost/unit | Cost amount |
|---|---|---|---|
| Supply of cement | 640 bag | ₹360 | ₹2,30,400 |
| Supply of sand | 48 cum | ₹1,500 | ₹72,000 |

The wall's own "Our cost" becomes **₹3,02,400** (the sum), so its
**profit** is ₹9,00,000 − ₹3,02,400 = **₹5,97,600**.

## Escalation

**Contract & billing details > Departmental escalation %** applies to
every row's **authority rate**, before the tender percentage - not to the
bid rate. This is deliberately different from the (now unused) DPR & Bills
BOQ, which escalates the bid rate instead - it matches how a real Railway
schedule-of-rates revision actually works: the department revises its own
rate, and your tender discount still applies on top of whatever it becomes.

## GST

**Contract & billing details > GST %** is the default, with a per-row
override. It is shown as an extra "Bid incl. GST" figure next to the plain
bid amount - **profit/loss is always worked out GST-exclusive**, since GST
is a tax you collect and pass on, not real income.

## Bulk import

**BOQ & Costing > Bulk import BOQ**: download the template, fill in Item
no, Description, Unit, Qty, and any of Authority rate, Tender/Awarded %,
Bid rate, Our cost and GST %. Rows nest by item number the same way as
manual entry (`1`, `1.1`, `1.1.1`). Re-uploading the same file adds
nothing - a row matching an existing item (by item no, else description)
is skipped, not duplicated.

## What changed in Costing

- **Removed**: the "Material rates" panel (a site-wide Concrete/TMT price
  list) and the old "Item costing" table, both of which only ever read
  from DPR & Bills items. Rates now live directly on each material row
  instead of a shared price list.
- **Kept for now**: Concrete production (stores) - it is not tied to DPR &
  Bills at all, and is planned to instead read from Store Reconciliation's
  own production module in a later pass.
- **Not touched**: DPR & Bills itself, and its section of the printable
  Reports page - both still exist and still work, for any project that
  still wants to use them.
