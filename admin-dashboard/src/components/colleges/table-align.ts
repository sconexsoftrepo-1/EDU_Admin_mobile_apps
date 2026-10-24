/**
 * Column alignment for data tables, from the column key: amounts and counts right-aligned,
 * statuses and yes/no flags centred, everything else (names, dates, phones, …) left-aligned.
 * Returns a class for both the <th> and its <td>s (styled in data-tables.css).
 */
const NUMERIC =
  /(amount|fee|fees|balance|total|paid|due_amount|outstanding|salary|net_pay|gross|pay$|price|cost|rate|gst|tax|score|marks|percent|percentage|count|qty|quantity|seats|capacity|credits|strength)/i;
const CENTERED =
  /^(status|active|enabled|is_.+|has_.+|verified|approved|published)$/i;

export function alignClass(key: string): string {
  if (CENTERED.test(key)) return "cell-center";
  if (
    NUMERIC.test(key) &&
    !/(date|_at|_on|code|name|type|method|mode|status)$/i.test(key)
  )
    return "num";
  return "";
}
