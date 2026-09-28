import { HelpCircle } from "lucide-react";

/**
 * A short, always-available explanation of how a DPR item feeds
 * Costing, with the same worked example as the written tutorial
 * (docs/project-monitor/dpr-to-costing.md).
 */
export function DprCostingHelp() {
  return (
    <details className="pm-howto">
      <summary>
        <HelpCircle size={16} /> How a DPR item links to Costing
      </summary>
      <div className="pm-howto__body">
        <p>
          A quantity entered on <strong>DPR &amp; Bills</strong> does
          two jobs: it is the <strong>value of work done</strong>{" "}
          (quantity x the item&apos;s rate) and it is{" "}
          <strong>material used</strong> (quantity x the concrete / TMT
          per unit on the item, priced at the material rates below).
          Costing sets that value against the day&apos;s expense and
          shows the margin.
        </p>

        <table className="pm-howto__table">
          <caption>
            Example: RCC retaining wall, bid rate ₹14,000 per cum,
            1 cum concrete and 80 kg TMT per cum, concrete ₹5,200 per
            cum, TMT ₹62,000 per MT - 10 cum entered
          </caption>
          <tbody>
            <tr>
              <td>Value of work done</td>
              <td>10 x 14,000</td>
              <td>₹1,40,000</td>
            </tr>
            <tr>
              <td>Concrete cost</td>
              <td>10 x 1 x 5,200</td>
              <td>₹52,000</td>
            </tr>
            <tr>
              <td>TMT cost</td>
              <td>10 x 80 kg = 0.8 MT x 62,000</td>
              <td>₹49,600</td>
            </tr>
            <tr>
              <td>Labour &amp; staff + machinery</td>
              <td>from HR and Machinery</td>
              <td>₹18,400</td>
            </tr>
            <tr>
              <td>
                <strong>Margin</strong>
              </td>
              <td>1,40,000 - 1,20,000 expense</td>
              <td>
                <strong>₹20,000</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <ul>
          <li>
            The two material fields on the item are the link - set
            them in the table below or on the DPR item form. Items
            that use neither stay at 0.
          </li>
          <li>
            A stores concrete figure for a day{" "}
            <strong>replaces</strong> the concrete estimate; it is
            never added on top.
          </li>
          <li>
            The BOQ fields (authority rate, tender %, escalation)
            only change the item&apos;s <strong>rate</strong> - never
            the material figures. Work already recorded keeps the
            rate it was entered at.
          </li>
        </ul>

        <h4>Reading the &quot;Item costing&quot; table below</h4>
        <p>
          Every item is created and quantities entered against it in{" "}
          <strong>DPR &amp; Bills</strong> - this table only reads what
          is set there and prices it, side by side, so you can see
          whether each item is running at a profit or a loss:
        </p>
        <ul>
          <li>
            <strong>Authority rate, Tender %, Bid rate</strong> - what
            we were awarded per unit (set on the item&apos;s Rates
            section in DPR &amp; Bills), the percentage above/below it
            we bid, and the rate that works out to.
          </li>
          <li>
            <strong>Rate today</strong> - the bid rate plus any
            escalation step in force today; this is what a quantity
            entered today is valued at.
          </li>
          <li>
            <strong>Executed qty / Executed value</strong> - what has
            actually been done so far, valued at the real rate each
            entry was made at (not today&apos;s rate) - the same
            figure the Financial Report bills against.
          </li>
          <li>
            <strong>Material cost to date / Margin to date</strong> -
            the material cost per unit multiplied by what has been
            executed, and what is left of the executed value after
            that cost. This covers concrete and TMT only - it does not
            include labour or machinery, which are logged per day for
            the whole site rather than against one item, so they
            cannot be split between items.
          </li>
        </ul>
        <p>
          The same table is available as an{" "}
          <strong>&quot;Item costing&quot;</strong> section on the
          Reports page, ready to print or save as a PDF.
        </p>
      </div>
    </details>
  );
}
