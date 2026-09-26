# How a DPR item links to Costing

Everything on **DPR & Bills** and everything on **Costing** is one chain. A
quantity entered against a DPR item does two jobs:

1. It is **value of work done** - quantity x the item's rate.
2. It is **material used** - quantity x what one unit of that item consumes
   (concrete in cum, TMT in kg), priced at the material rates in Costing.

Costing then sets the value against the expense (materials + labour + staff +
machinery) for the same day and shows the **margin**.

```
DPR quantity  x  item rate                         = value of work done
DPR quantity  x  concrete per unit  x  concrete rate = concrete cost
DPR quantity  x  TMT per unit (kg) / 1000 x TMT rate = TMT cost

expense = concrete + TMT + labour & staff (HR) + machinery
margin  = value - expense
```

## Where each number is set

| Number | Where you set it | Who |
|---|---|---|
| Item quantity, rate, **concrete per unit**, **TMT per unit** | DPR & Bills > **Add item / Edit item** | DPR & Bills entry |
| The same two material fields, in a table | Costing > Rates & production > **DPR items and material use** | Admin and Director edit |
| **Concrete rate** and **TMT rate** (with a w.e.f. date) | Costing > Rates & production > **Material rates** | Admin and Director |
| Labour and staff cost per day | **HR** | HR department |
| Machinery, fuel, maintenance per day | **Machinery** | Machinery department |
| Concrete actually produced (cost from stores) | Costing > Rates & production > **Concrete production (stores)** | Admin |

The two material fields on an item are the *link*. An item that uses neither
(say a road-crossing signboard) is simply left at 0 - it still counts as value
of work done, it just adds no material cost.

## Worked example

Item **RCC retaining wall**, unit **cum**.

- Bid rate **₹14,000** per cum
- Concrete per unit **1** cum (one cum of concrete per cum of wall)
- TMT per unit **80** kg
- Material rates in force that day: concrete **₹5,200** per cum, TMT **₹62,000**
  per MT
- That day's HR cost **₹12,000**, machinery cost **₹6,400**

The site enters **10 cum** in the DPR grid.

| | Working | Amount |
|---|---|---|
| Value of work done | 10 x 14,000 | ₹1,40,000 |
| Concrete cost | 10 x 1 x 5,200 | ₹52,000 |
| TMT cost | 10 x 80 kg = 0.8 MT x 62,000 | ₹49,600 |
| Labour and staff | from HR | ₹12,000 |
| Machinery | from Machinery | ₹6,400 |
| **Expense** | | **₹1,20,000** |
| **Margin before overheads** | 1,40,000 - 1,20,000 | **₹20,000** |
| Expense / value | | 85.7% |

Costing flags a day when expense passes **90%** of the value.

**If stores has a concrete figure for the day** (Concrete production register),
it **replaces** the concrete estimate - it is never added on top. Say stores
shows ₹55,000 of concrete for that day: concrete becomes 55,000, expense
becomes ₹1,23,000 and the margin ₹17,000. TMT is always the estimate above.

The **Cost table** shows one line like this for every day, and each line has a
small dot per feed (DPR, HR, Machinery, Stores) so a day with nothing uploaded
cannot pass for a good margin.

## What the Railway BOQ fields change - and what they do not

The new BOQ fields on **Add item** only change the item's **rate** - the *value
of work* side. They never change the material figures.

| Field | Meaning |
|---|---|
| **Authority rate** | The Railway estimated / schedule rate |
| **Tender %** | Percentage **above (+) or below (-)** the authority rate. One **contract-wide** value in *Contract & billing details*; an item can have its own |
| **Bid rate** | Our rate = authority rate x (1 + tender % / 100). Worked out for you |
| **Escalation** | Dated steps for the contract. Each step is the **total** % over the bid rate from that date |
| **Rate today** | Bid rate x (1 + escalation %) - the rate new entries and bills use |

Example: authority rate ₹12,500, contract-wide tender **+12%** -> bid rate
**₹14,000** (the rate used above). An escalation of **+5%** from 1 September
means work entered from that day is priced at ₹14,700. Each step *replaces* the
one before it - it is the total over the bid rate, not an increment.

An item with **no authority rate** keeps a hand-typed rate exactly as before.

### History never moves

Every DPR entry and bill line **keeps the rate it was entered at**. Changing the
tender %, adding an escalation, or editing a rate only affects work entered
afterwards. The form tells you how many entries are already recorded on the old
rate. (Re-typing a quantity in a grid cell re-saves that entry, so it is then
priced at the rate in force on *that day*.)

## Groups and sub-groups

Items sit in a tree up to **3 levels** (`4` -> `4.1` -> `4.1.1`). A **group**
(heading) has no quantity, rate or materials - it only adds up the items under
it. Only the **lowest-level items** take DPR entries, measurements, bill lines
and the material link, so nothing is counted twice: totals, Costing and the
financial report all use the items, and show the group as a subtotal.

- **Add item** > *This is a group* > add its **Sub-items** in one go, or use the
  **+** on a group's row later.
- You can import a BOQ from Excel: give **Item no**, **Description**, **Unit**,
  **Qty** and any of **Authority rate**, **Tender %**, **Quoted rate**. Rows nest
  by item number, and a numbered row with nothing but a description that has
  rows nested under it becomes a group. Re-importing the same file adds nothing.

## Daily measurement

When you type a day's quantity in the DPR grid, a **measurement sheet** opens
under that item's row: description / location, **Nos, L, B, D**, and a
**Deduct** tick for openings and overlaps. A line's quantity is Nos x whichever
of L / B / D are filled (Nos alone is a plain count). The sheet shows
*Matches the 15 entered*, *Measured 12.5 of 15 entered* or *Measured 17 - 2 more
than the 15 entered*, and **Use measured total** copies its total into the cell.

Measurements are supporting detail. They never block **Save DPR**, never change
the quantity by themselves, and follow the same 3-day edit window as the DPR.
The **Register** tab lists the sheets and can print them.

## Today at a glance

Costing > **Today at a glance** has a period filter: **Today, Yesterday, Last 7
days, Month to date, Last month, Whole project** and **Pick a date**. The cards
(value of work done, total expense, margin, labour on site, concrete) always
describe the period you picked, and a line underneath names any feed with
nothing recorded so an incomplete period cannot look better than it is.

## Setting a project up - checklist

1. **Contract & billing details**: value, LOA no., and the contract-wide
   **Tender %** if the tender was quoted above / below the authority rates.
2. **DPR & Bills**: add the BOQ (groups, then items with their authority rate),
   or import it from Excel.
3. On each item set **Concrete per unit** and **TMT per unit** where it uses
   them.
4. **Costing > Rates & production**: add the **concrete** and **TMT** rates with
   their w.e.f. dates. The *DPR items and material use* table flags any item
   whose material has no rate yet.
5. Every day: DPR quantities (with measurements), HR cost, machinery cost -
   and, when available, the concrete produced per stores.
6. When the Railway allows escalation, add a step under **Escalation**.

## Common questions

**An item shows "No material usage set".** Concrete and TMT per unit are both 0,
so it adds value but no material cost. Set them if it should.

**A cost line says a rate is missing.** The item uses concrete or TMT but no
rate is in force on that date. Add a w.e.f. rate.

**Escalation changed my costs?** It changes the *value of work* (rate) only. If
the Railway's escalation also raises your material prices, add a new material
rate with a w.e.f. date.

**Can I edit an old day?** Only today and the 3 days before are open; an Admin
can unlock older days with a reason.
