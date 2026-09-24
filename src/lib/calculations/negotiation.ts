import type { ScenarioAssumptions, SupplierQuote } from "@/lib/types";
import type { LandedCostResult } from "./landed-cost";
import { calcPaymentTermsValue, paymentTermsLabel } from "./payment-terms";

export interface NegotiationInsight {
  id: string;
  supplierId: string;
  supplierName: string;
  category: "freight" | "payment-terms" | "volume-discount" | "setup-fee" | "lead-time" | "warranty";
  /** What's weaker in this supplier's quote. */
  issue: string;
  /** The best competing term, and who offers it. */
  benchmark: string;
  /** The size of the gap in dollars or terms. */
  gap: string;
  /** Dollar value of the gap per order, when it can be calculated. Used for ordering. */
  gapValue: number | null;
  /** Suggested negotiation ask. */
  ask: string;
}

interface NegotiationContext {
  quote: SupplierQuote;
  landedCost: LandedCostResult;
}

const usd0 = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const nm = (q: SupplierQuote) => q.supplierName || "This supplier";

/**
 * Builds negotiation asks by comparing each supplier's quote with the best
 * competing term in the comparison. Every figure comes from quoted data; the
 * payment-terms gap is valued with the same cost-of-capital method as landed cost.
 */
export function buildNegotiationInsights(contexts: NegotiationContext[], assumptions: ScenarioAssumptions): NegotiationInsight[] {
  const insights: NegotiationInsight[] = [];
  if (contexts.length < 2) return insights;
  let seq = 0;
  const push = (c: NegotiationContext, i: Omit<NegotiationInsight, "id" | "supplierId" | "supplierName">) =>
    insights.push({ id: `insight-${seq++}`, supplierId: c.quote.id, supplierName: nm(c.quote), ...i });
  const qty = assumptions.requiredQuantity.toLocaleString();

  // --- Freight, at the scenario quantity.
  const knownShipping = contexts.filter((c) => c.landedCost.shippingCost != null);
  if (knownShipping.length >= 2) {
    const lowest = knownShipping.reduce((a, b) => ((b.landedCost.shippingCost as number) < (a.landedCost.shippingCost as number) ? b : a));
    const low = lowest.landedCost.shippingCost as number;
    for (const c of knownShipping) {
      const mine = c.landedCost.shippingCost as number;
      const diff = mine - low;
      if (diff > 0 && (diff >= 100 || diff / Math.max(1, c.landedCost.subtotalKnownCosts) > 0.02)) {
        push(c, {
          category: "freight",
          issue: `Freight is ${usd0(mine)} at ${qty} units`,
          benchmark: `${nm(lowest.quote)}: ${low === 0 ? "free shipping" : usd0(low)}`,
          gap: `${usd0(diff)} per order`,
          gapValue: diff,
          ask: low === 0 ? `Ask ${nm(c.quote)} to include freight at no charge.` : `Ask ${nm(c.quote)} to reduce freight to ${usd0(low)} or below.`,
        });
      }
    }
  }

  // --- Payment terms: gap valued at your cost of capital.
  const knownNet = contexts.filter((c) => c.quote.paymentTerms.type === "net" && c.quote.paymentTerms.netDays != null);
  if (knownNet.length >= 2) {
    const best = knownNet.reduce((a, b) => ((b.quote.paymentTerms.netDays as number) > (a.quote.paymentTerms.netDays as number) ? b : a));
    const bestDays = best.quote.paymentTerms.netDays as number;
    for (const c of knownNet) {
      const days = c.quote.paymentTerms.netDays as number;
      const gapDays = bestDays - days;
      if (gapDays < 15) continue;
      const matched = calcPaymentTermsValue(c.landedCost.subtotalKnownCosts, best.quote.paymentTerms, assumptions.annualCostOfCapitalPercent);
      const value = matched - c.landedCost.paymentTermsValue;
      const fallback = Math.round((days + bestDays) / 2 / 15) * 15;
      push(c, {
        category: "payment-terms",
        issue: `Payment due ${paymentTermsLabel(c.quote.paymentTerms)}`,
        benchmark: `${nm(best.quote)}: ${paymentTermsLabel(best.quote.paymentTerms)}`,
        gap: `${gapDays} days · ≈ ${usd0(value)} per order at ${assumptions.annualCostOfCapitalPercent}% cost of capital`,
        gapValue: value,
        ask:
          fallback > days && fallback < bestDays
            ? `Ask for Net ${bestDays}; accept Net ${fallback} as a fallback.`
            : `Ask ${nm(c.quote)} to match Net ${bestDays}.`,
      });
    }
  }

  // --- Volume discounts: suppliers with none when a competitor offers one.
  const withDiscount = contexts.filter((c) => c.quote.volumeDiscounts.length > 0);
  for (const c of contexts.filter((x) => x.quote.volumeDiscounts.length === 0 && x.quote.unitPrice != null)) {
    const tiers = withDiscount
      .filter((d) => d.quote.id !== c.quote.id)
      .flatMap((d) => d.quote.volumeDiscounts.map((t) => ({ t, q: d.quote })));
    if (tiers.length === 0) continue;
    const reachable = tiers.filter((x) => assumptions.requiredQuantity >= x.t.minQuantity);
    const pick = reachable.length > 0
      ? reachable.reduce((a, b) => (b.t.discountPercent > a.t.discountPercent ? b : a))
      : tiers.reduce((a, b) => (b.t.minQuantity < a.t.minQuantity ? b : a));
    const base = c.landedCost.basePurchaseCost ?? 0;
    const applies = assumptions.requiredQuantity >= pick.t.minQuantity;
    push(c, {
      category: "volume-discount",
      issue: "No volume discount offered",
      benchmark: `${nm(pick.q)}: ${pick.t.discountPercent}% off at ${pick.t.minQuantity.toLocaleString()}+ units`,
      gap: applies
        ? `${pick.t.discountPercent}% ≈ ${usd0((base * pick.t.discountPercent) / 100)} at ${qty} units`
        : `Tier starts above your ${qty}-unit requirement`,
      gapValue: applies ? (base * pick.t.discountPercent) / 100 : null,
      ask: applies
        ? `Ask ${nm(c.quote)} for a ${pick.t.discountPercent}% discount at ${qty} units.`
        : `Ask ${nm(c.quote)} whether a discount tier exists at or above ${pick.t.minQuantity.toLocaleString()} units for future orders.`,
    });
  }

  // --- Setup fees: only when a competitor explicitly charges none.
  const noSetup = contexts.filter((c) => c.quote.setupFees === 0);
  if (noSetup.length > 0) {
    for (const c of contexts.filter((x) => x.quote.setupFees != null && x.quote.setupFees > 0)) {
      const fee = c.quote.setupFees as number;
      push(c, {
        category: "setup-fee",
        issue: `${usd0(fee)} one-time setup fee`,
        benchmark: `${nm(noSetup[0].quote)}: no setup fee`,
        gap: `${usd0(fee)} per setup`,
        gapValue: fee,
        ask: `Ask ${nm(c.quote)} to waive the setup fee, or credit it against future orders.`,
      });
    }
  }

  // --- Lead time vs. fastest.
  const knownLead = contexts.filter((c) => c.quote.leadTimeDays != null);
  if (knownLead.length >= 2) {
    const fastest = knownLead.reduce((a, b) => ((b.quote.leadTimeDays as number) < (a.quote.leadTimeDays as number) ? b : a));
    const fast = fastest.quote.leadTimeDays as number;
    for (const c of knownLead) {
      const gap = (c.quote.leadTimeDays as number) - fast;
      if (gap < 7) continue;
      push(c, {
        category: "lead-time",
        issue: `${c.quote.leadTimeDays}-day lead time`,
        benchmark: `${nm(fastest.quote)}: ${fast} days`,
        gap: `${gap} days slower`,
        gapValue: null,
        ask: `Ask ${nm(c.quote)} to shorten delivery toward ${fast} days, or offset the slower lead time with a lower price.`,
      });
    }
  }

  // --- Warranty.
  const withWarranty = contexts.filter((c) => c.quote.warranty && c.quote.warranty.trim().length > 0);
  if (withWarranty.length > 0) {
    for (const c of contexts.filter((x) => !x.quote.warranty && x.quote.unitPrice != null)) {
      push(c, {
        category: "warranty",
        issue: "No warranty stated",
        benchmark: `${nm(withWarranty[0].quote)}: ${withWarranty[0].quote.warranty}`,
        gap: "Coverage unknown",
        gapValue: null,
        ask: `Ask ${nm(c.quote)} to state warranty coverage in writing before ordering.`,
      });
    }
  }

  return insights;
}
