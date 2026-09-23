import type { PaymentTerms } from "@/lib/types";

/**
 * Economic value of a supplier's payment terms, expressed as a dollar credit
 * against the total cost.
 *
 * Methodology: money you don't have to pay yet is money you can keep earning
 * (or avoid borrowing) a return on. We approximate that return using the
 * business's annual cost of capital, applied simply (not compounded) over
 * the number of days payment is delayed:
 *
 *   value = amountDue * (annualCostOfCapital / 100) * (daysDelayed / 365)
 *
 * For a deposit paid before delivery, that portion is treated as receiving
 * no benefit (and no further penalty beyond losing the benefit it would
 * otherwise have earned under the remaining terms).
 *
 * This is a simplification (no compounding, no modeling of your own payable
 * cycle) but it is transparent and directionally correct, which is the goal
 * for an MVP: showing that "pay later" has calculable value, not just
 * intuitive value.
 */
export function calcPaymentTermsValue(
  amountDue: number,
  terms: PaymentTerms,
  annualCostOfCapitalPercent: number
): number {
  if (amountDue <= 0) return 0;
  const rate = annualCostOfCapitalPercent / 100;

  if (terms.type === "immediate") return 0;

  if (terms.type === "deposit") {
    const depositPercent = terms.depositPercent ?? 100;
    const remainderPercent = 100 - depositPercent;
    const remainderAmount = amountDue * (remainderPercent / 100);
    const days = terms.netDays ?? 0;
    return remainderAmount * rate * (days / 365);
  }

  // "net" or "custom" — use netDays if present, otherwise no calculable benefit.
  const days = terms.netDays ?? 0;
  if (days <= 0) return 0;
  return amountDue * rate * (days / 365);
}

export function paymentTermsLabel(terms: PaymentTerms): string {
  switch (terms.type) {
    case "immediate":
      return "Due immediately";
    case "net":
      return terms.netDays != null ? `Net ${terms.netDays}` : "Net terms (days not specified)";
    case "deposit": {
      const pct = terms.depositPercent != null ? `${terms.depositPercent}%` : "Unspecified %";
      const days = terms.netDays != null ? `, remainder Net ${terms.netDays}` : "";
      return `${pct} deposit${days}`;
    }
    case "custom":
      return terms.description || "Custom terms";
    default:
      return "Unspecified";
  }
}
