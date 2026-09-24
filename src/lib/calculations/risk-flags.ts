import type { ScenarioAssumptions, ScoringWeights, SupplierQuote } from "@/lib/types";
import type { LandedCostResult } from "./landed-cost";
import { isPaymentTermsQuantifiable } from "./payment-terms";

export type FlagSeverity = "high" | "medium" | "low";

export interface RiskFlag {
  id: string;
  supplierId: string;
  supplierName: string;
  /** "risk" needs a decision or mitigation; "missing" is information to request. */
  kind: "risk" | "missing";
  severity: FlagSeverity;
  title: string;
  detail: string | null;
  /** The concrete next step. */
  action: string;
  /** What the gap affects in this comparison. */
  impact: "Landed cost" | "Score" | "Terms" | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const usd0 = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const COST_ACTIONS: Record<string, (n: string) => string> = {
  "Unit price": (n) => `Request a unit price from ${n} at your required quantity.`,
  "Shipping cost": (n) => `Ask ${n} for a freight quote to your delivery location.`,
  "Taxes / fees": (n) => `Ask ${n} for a tax and fee breakdown at your quantity.`,
  "Setup fee": (n) => `Confirm with ${n} whether any setup or tooling fee applies.`,
  "Other fees": (n) => `Ask ${n} to confirm there are no other charges.`,
};

export function buildRiskFlags(
  quote: SupplierQuote,
  landedCost: LandedCostResult,
  assumptions: ScenarioAssumptions,
  weights: ScoringWeights,
  now: Date = new Date()
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const name = quote.supplierName || "This supplier";
  let seq = 0;
  const push = (f: Omit<RiskFlag, "id" | "supplierId" | "supplierName">) =>
    flags.push({ id: `${quote.id}-flag-${seq++}`, supplierId: quote.id, supplierName: name, ...f });

  // ---------------- Material risks
  if (quote.quoteExpirationDate) {
    const expiry = new Date(quote.quoteExpirationDate);
    const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysUntil < 0) {
      push({
        kind: "risk", severity: "high", impact: "Terms",
        title: `Quote expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago`,
        detail: "Prices and terms may no longer be honored.",
        action: `Request a refreshed quote from ${name} before relying on these numbers.`,
      });
    } else if (daysUntil <= 7) {
      push({
        kind: "risk", severity: "high", impact: "Terms",
        title: `Quote expires in ${daysUntil} day${daysUntil === 1 ? "" : "s"} (${shortDate(expiry)})`,
        detail: "After this date the quoted price and terms are no longer guaranteed.",
        action: `Decide by ${shortDate(expiry)}, or ask ${name} for a written extension.`,
      });
    } else if (daysUntil <= 14) {
      push({
        kind: "risk", severity: "medium", impact: "Terms",
        title: `Quote expires ${shortDate(expiry)} (${daysUntil} days)`,
        detail: null,
        action: `Plan to decide, or request an extension, before ${shortDate(expiry)}.`,
      });
    }
  }

  if (landedCost.belowMinimumOrderQuantity) {
    push({
      kind: "risk", severity: "high", impact: "Terms",
      title: `Below minimum order quantity by ${landedCost.moqShortfall?.toLocaleString()} units`,
      detail: `${name} requires at least ${quote.minimumOrderQuantity?.toLocaleString()} units; you need ${assumptions.requiredQuantity.toLocaleString()}.`,
      action: `Order at least ${quote.minimumOrderQuantity?.toLocaleString()} units, or ask ${name} to accept a smaller order.`,
    });
  }

  const maxLead = assumptions.maxAcceptableLeadTimeDays;
  if (maxLead != null && quote.leadTimeDays != null && quote.leadTimeDays > maxLead) {
    const over = quote.leadTimeDays - maxLead;
    push({
      kind: "risk", severity: "high", impact: "Terms",
      title: `Lead time exceeds your ${maxLead}-day limit`,
      detail: `${quote.leadTimeDays} days quoted — ${over} days over.`,
      action: `Ask ${name} for expedited delivery, or place orders at least ${over} days earlier.`,
    });
  }

  if (quote.contractLengthMonths != null && quote.contractLengthMonths >= 12) {
    push({
      kind: "risk", severity: "medium", impact: "Terms",
      title: `Requires a ${quote.contractLengthMonths}-month commitment`,
      detail: "You're locked in if demand, pricing, or quality changes.",
      action: `Confirm ${quote.contractLengthMonths} months of demand, and negotiate an exit or volume-flex clause before signing.`,
    });
  }

  if (quote.reliabilityRating != null && quote.reliabilityRating <= 2) {
    push({
      kind: "risk", severity: "medium", impact: "Score",
      title: `Low reliability rating (${quote.reliabilityRating}/5)`,
      detail: quote.qualitativeComments,
      action: `Ask ${name} for on-time delivery data or references, and consider a late-delivery penalty clause.`,
    });
  }

  // ---------------- Missing information that changes the numbers
  for (const field of landedCost.missingFields) {
    const isUnitPrice = field === "Unit price";
    push({
      kind: "missing", severity: isUnitPrice ? "high" : "medium", impact: "Landed cost",
      title: `${field} not provided`,
      detail: isUnitPrice
        ? "Landed cost can't be calculated, so this quote is excluded from cost ranking and price scoring."
        : `Excluded from landed cost, so ${name}'s ${usd0(landedCost.totalLandedCost)} is a minimum.`,
      action: COST_ACTIONS[field]?.(name) ?? `Ask ${name} to specify ${field.toLowerCase()}.`,
    });
  }

  const scoreGaps: { missing: boolean; weight: number; title: string; action: string }[] = [
    { missing: quote.leadTimeDays == null, weight: weights.leadTime, title: "Lead time not stated", action: `Ask ${name} for a committed lead time.` },
    {
      missing: !isPaymentTermsQuantifiable(quote.paymentTerms),
      weight: weights.paymentTerms,
      title: "Payment terms incomplete",
      action: `Ask ${name} to state payment terms in days (e.g. Net 30).`,
    },
    { missing: quote.reliabilityRating == null, weight: weights.reliability, title: "No reliability rating", action: "Add your 1–5 reliability rating via Edit on the supplier card." },
    {
      missing: quote.contractLengthMonths == null,
      weight: weights.flexibility,
      title: "Contract length not stated",
      action: `Ask ${name} whether this order requires a contract commitment, and for how long.`,
    },
  ];
  for (const g of scoreGaps.filter((x) => x.missing && x.weight > 0)) {
    push({
      kind: "missing", severity: "medium", impact: "Score",
      title: g.title,
      detail: `Not scored — its ${g.weight}% weight is redistributed across ${name}'s known factors.`,
      action: g.action,
    });
  }

  // ---------------- Lower-impact terms, grouped into one request
  const unstated = [
    !quote.quoteExpirationDate && "quote expiration",
    quote.minimumOrderQuantity == null && "minimum order quantity",
    !quote.warranty && "warranty",
    !quote.returnPolicy && "return policy",
    !quote.cancellationTerms && "cancellation terms",
  ].filter((x): x is string => Boolean(x));
  if (unstated.length > 0) {
    push({
      kind: "missing", severity: "low", impact: "Terms",
      title: `Not stated: ${unstated.join(", ")}`,
      detail: null,
      action: `Request ${unstated.length === 1 ? "this term" : "these terms"} from ${name} in writing before issuing a PO.`,
    });
  }

  return flags;
}

export function buildAllRiskFlags(
  contexts: { quote: SupplierQuote; landedCost: LandedCostResult }[],
  assumptions: ScenarioAssumptions,
  weights: ScoringWeights,
  now: Date = new Date()
): RiskFlag[] {
  return contexts.flatMap((c) => buildRiskFlags(c.quote, c.landedCost, assumptions, weights, now));
}
