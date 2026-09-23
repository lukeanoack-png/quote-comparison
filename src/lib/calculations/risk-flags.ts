import type { SupplierQuote } from "@/lib/types";
import type { LandedCostResult } from "./landed-cost";

export type FlagSeverity = "high" | "medium" | "low";

export interface RiskFlag {
  id: string;
  supplierId: string;
  supplierName: string;
  severity: FlagSeverity;
  message: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function buildRiskFlags(
  quote: SupplierQuote,
  landedCost: LandedCostResult,
  now: Date = new Date()
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const name = quote.supplierName || "This supplier";
  let seq = 0;
  const push = (severity: FlagSeverity, message: string) =>
    flags.push({ id: `${quote.id}-flag-${seq++}`, supplierId: quote.id, supplierName: quote.supplierName, severity, message });

  // Missing cost fields (already computed by calcLandedCost).
  for (const field of landedCost.missingFields) {
    push("medium", `${name} did not specify ${field.toLowerCase()}.`);
  }

  // Quote expiration.
  if (quote.quoteExpirationDate) {
    const expiry = new Date(quote.quoteExpirationDate);
    const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysUntil < 0) {
      push("high", `${name}'s quote expired ${Math.abs(daysUntil)} day(s) ago.`);
    } else if (daysUntil <= 7) {
      push("high", `${name}'s quote expires in ${daysUntil} day(s).`);
    }
  } else {
    push("low", `${name} did not specify a quote expiration date.`);
  }

  // MOQ shortfall.
  if (landedCost.belowMinimumOrderQuantity) {
    push(
      "high",
      `Required quantity is below ${name}'s minimum order quantity by ${landedCost.moqShortfall?.toLocaleString()} unit(s).`
    );
  }
  if (quote.minimumOrderQuantity == null) {
    push("low", `${name} did not specify a minimum order quantity.`);
  }

  // Warranty / return / cancellation.
  if (!quote.warranty) push("medium", `${name} does not specify a warranty or guarantee.`);
  if (!quote.returnPolicy) push("low", `${name} does not specify a return policy.`);
  if (!quote.cancellationTerms) push("low", `${name} does not specify cancellation terms.`);

  // Payment terms detail.
  if (quote.paymentTerms.type === "net" && quote.paymentTerms.netDays == null) {
    push("medium", `${name}'s net payment term does not specify the number of days.`);
  }
  if (quote.paymentTerms.type === "custom" && !quote.paymentTerms.description) {
    push("medium", `${name}'s payment terms are marked custom but not described.`);
  }

  // Lead time.
  if (quote.leadTimeDays == null) {
    push("medium", `${name} did not specify a lead time.`);
  }

  // Contract length.
  if (quote.contractLengthMonths == null) {
    push("low", `${name} did not specify a contract length (assumed month-to-month for scoring).`);
  }

  return flags;
}

export function buildAllRiskFlags(
  contexts: { quote: SupplierQuote; landedCost: LandedCostResult }[],
  now: Date = new Date()
): RiskFlag[] {
  return contexts.flatMap((c) => buildRiskFlags(c.quote, c.landedCost, now));
}
