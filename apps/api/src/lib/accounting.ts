import Decimal from "decimal.js";

export function validateDoubleEntry(lines: Array<{ debit?: string | null; credit?: string | null }>) {
  const debits = lines.reduce(
    (sum, line) => sum.plus(line.debit || "0"),
    new Decimal(0)
  );
  const credits = lines.reduce(
    (sum, line) => sum.plus(line.credit || "0"),
    new Decimal(0)
  );

  if (!debits.equals(credits)) {
    throw new Error(`Unbalanced entry: debits ${debits} != credits ${credits}`);
  }
}

export function formatCurrency(amount: string | number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(new Decimal(amount).toNumber());
}
