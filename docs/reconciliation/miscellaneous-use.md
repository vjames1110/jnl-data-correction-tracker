# Miscellaneous use of materials

Some recipe materials (cement, sand, aggregate) are also used for work that
is **not** the production being reconciled - for example a boundary wall or a
site road. That quantity leaves stock but is not in the production output, so
without a way to record it, it reads as an unexplained **loss** against the
recipe.

The **Miscellaneous Use** section on **Monthly Entry** (directly below
**Production Output**) fixes that. You record only the **consumed quantity**;
the system deducts it from the material's consumption before working out
variance.

## How the numbers change

For a recipe (norm-based) material:

```
Actual (production use) = Opening + Receipts - Closing - Miscellaneous use
Variance                = Theoretical - Actual
```

Worked example - 100 cum of M25 produced, cement mix ratio 0.40 per cum:

| | Without misc use | With 5 MT logged as misc use |
|---|---|---|
| Opening / Receipts / Closing | 10 / 50 / 15 | 10 / 50 / 15 |
| Consumption taken from stock | 45 | 45 |
| Less: miscellaneous use | - | 5 |
| **Actual** | **45** | **40** |
| Theoretical (100 x 0.40) | 40 | 40 |
| **Variance** | **-5 (loss, over tolerance)** | **0 (within tolerance)** |

The stored variance, its value in rupees, the status, the variance reports and
the dashboard all follow, because they read the adjusted actual.

## Using it

1. Open **Production -> Monthly Entry**, choose the site and month.
2. In **Miscellaneous Use**, pick the **Material** and type the **Consumed
   Quantity** (in the material's own unit), then **Add Usage**.
3. To change the quantity use the pencil icon; to remove it use the bin icon.
   The material's monthly entry is recalculated straight away.
4. The material's row under **Recipe Materials** now shows a **Misc. use** line
   under its opening/receipts/closing.

Rules:

- One row per material per month - edit it rather than adding a second.
- Only recipe (norm-based) materials can be logged; direct-count items are
  counted, not derived from stock movement.
- The quantity must be more than zero. If it is more than was actually taken
  out of stock (Opening + Receipts - Closing), the entry is flagged with a
  **negative consumption** warning - check the figures.
- It follows the same period rules as the rest of the entry: editable only
  while the period is in **Draft**. Director can see it but not change it.
- It works offline like the other sections; changes made offline show a
  **Queued** tag until they sync.

## In the reports

- The printed **Production Reconciliation Statement** gets a
  **Less: Miscellaneous Use (non-production)** row in Section 1 when any
  material had some, and the last row is then titled **Net Consumption for
  Production (Actual)**. A month with no misc use prints exactly as before.
- **Export CSV** has a **Misc. Use** column between **Closing** and **Actual**.
