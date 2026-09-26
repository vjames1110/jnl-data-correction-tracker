/**
 * The legend every multi-series chart carries (a single series needs
 * none - its title names it). A coloured swatch beside plain text:
 * identity never rides on the colour of the text itself.
 */
export function ChartLegend({ series }) {
  return (
    <ul className="pm-viz__legend">
      {series.map((item) => (
        <li key={item.key}>
          <span
            className={`pm-viz__key pm-viz__key--${item.token}`}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
