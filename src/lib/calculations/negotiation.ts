import type { SupplierQuote } from "@/lib/types";
import type { LandedCostResult } from "./landed-cost";
import { paymentTermsLabel } from "./payment-terms";

export interface NegotiationInsight {
  id: string;
  supplierId: string;
  supplierName: string;
  category: "freight" | "payment-terms" | "volume-discount" | "setup-fee" | "lead-time" | "warranty" | "moq";
  /** Factual observation: what the gap is, based only on provided quote data. */
  observation: string;
  /** Suggested ask, derived directly from the observation. */
  suggestion: string;
}

interface NegotiationContext {
  quote: SupplierQuote;
  landedCost: LandedCostResult;
}

const currency = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function buildNegotiationInsights(contexts: NegotiationContext[]): NegotiationInsight[] {
  const insights: NegotiationInsight[] = [];
  if (contexts.length < 2) return insights;
  let seq = 0;
  const nextId = () => `insight-${seq++}`;

  // --- Freight: compare against the lowest known shipping cost.
  const knownShipping = contexts.filter((c) => c.quote.shippingCost != null);
  if (knownShipping.length >= 2) {
    const lowest = knownShipping.reduce((a, b) => ((b.quote.shippingCost as number) < (a.quote.shippingCost as number) ? b : a));
    for (const c of knownShipping) {
      const diff = (c.quote.shippingCost as number) - (lowest.quote.shippingCost as number);
      if (diff > 0 && (diff >= 100 || diff / Math.max(1, c.landedCost.subtotalKnownCosts) > 0.02)) {
        insights.push({
          id: nextId(),
          supplierId: c.quote.id,
          supplierName: c.quote.supplierName,
          category: "freight",
          observation: `${c.quote.supplierName || "This supplier"}'s shipping cost is ${currency(diff)} higher than ${lowest.quote.supplierName || "the lowest-freight supplier"}'s (${currency(c.quote.shippingCost as number)} vs. ${currency(lowest.quote.shippingCost as number)}).`,
          suggestion: `Ask ${c.quote.supplierName || "this supplier"} to match or reduce freight toward ${currency(lowest.quote.shippingCost as number)}.`,
        });
      }
    }
  }

  // --- Payment terms: compare net days.
  const knownNetDays = contexts.filter((c) => c.quote.paymentTerms.type === "net" && c.quote.paymentTerms.netDays != null);
  if (knownNetDays.length >= 2) {
    const best = knownNetDays.reduce((a, b) => ((b.quote.paymentTerms.netDays as number) > (a.quote.paymentTerms.netDays as number) ? b : a));
    for (const c of knownNetDays) {
      const gap = (best.quote.paymentTerms.netDays as number) - (c.quote.paymentTerms.netDays as number);
      if (gap >= 15) {
        insights.push({
          id: nextId(),
          supplierId: c.quote.id,
          supplierName: c.quote.supplierName,
          category: "payment-terms",
          observation: `${best.quote.supplierName || "Another supplier"} offers ${paymentTermsLabel(best.quote.paymentTerms)} while ${c.quote.supplierName || "this supplier"} requires ${paymentTermsLabel(c.quote.paymentTerms)}.`,
          suggestion: `Ask ${c.quote.supplierName || "this supplier"} to match Net ${best.quote.paymentTerms.netDays} payment terms.`,
        });
      }
    }
  }

  // --- Volume discounts: flag suppliers with none when another offers one.
  const withDiscount = contexts.filter((c) => c.quote.volumeDiscounts.length > 0);
  const withoutDiscount = contexts.filter((c) => c.quote.volumeDiscounts.length === 0 && c.quote.unitPrice != null);
  if (withDiscount.length > 0 && withoutDiscount.length > 0) {
    const example = withDiscount[0];
    const tier = [...example.quote.volumeDiscounts].sort((a, b) => a.minQuantity - b.minQuantity)[0];
    for (const c of withoutDiscount) {
      insights.push({
        id: nextId(),
        supplierId: c.quote.id,
        supplierName: c.quote.supplierName,
        category: "volume-discount",
        observation: `${example.quote.supplierName || "Another supplier"} offers a ${tier.discountPercent}% discount above ${tier.minQuantity.toLocaleString()} units; ${c.quote.supplierName || "this supplier"} lists no volume discount.`,
        suggestion: `Ask ${c.quote.supplierName || "this supplier"} whether a volume discount applies at your required quantity.`,
      });
    }
  }

  // --- Setup fees: flag suppliers charging one when others don't.
  const withSetupFee = contexts.filter((c) => c.quote.setupFees != null && c.quote.setupFees > 0);
  const withoutSetupFee = contexts.filter((c) => c.quote.setupFees === 0 || (c.quote.setupFees == null && c.quote.unitPrice != null));
  if (withSetupFee.length > 0 && withoutSetupFee.length > 0) {
    for (const c of withSetupFee) {
      insights.push({
        id: nextId(),
        supplierId: c.quote.id,
        supplierName: c.quote.supplierName,
        category: "setup-fee",
        observation: `${c.quote.supplierName || "This supplier"} charges a ${currency(c.quote.setupFees as number)} setup fee that other suppliers in this comparison do not.`,
        suggestion: `Ask ${c.quote.supplierName || "this supplier"} to waive or reduce the ${currency(c.quote.setupFees as number)} setup fee.`,
      });
    }
  }

  // --- Lead time: compare against fastest.
  const knownLead = contexts.filter((c) => c.quote.leadTimeDays != null);
  if (knownLead.length >= 2) {
    const fastest = knownLead.reduce((a, b) => ((b.quote.leadTimeDays as number) < (a.quote.leadTimeDays as number) ? b : a));
    for (const c of knownLead) {
      const gap = (c.quote.leadTimeDays as number) - (fastest.quote.leadTimeDays as number);
      if (gap >= 7) {
        insights.push({
          id: nextId(),
          supplierId: c.quote.id,
          supplierName: c.quote.supplierName,
          category: "lead-time",
          observation: `${fastest.quote.supplierName || "Another supplier"} can deliver in ${fastest.quote.leadTimeDays} days, ${gap} days faster than ${c.quote.supplierName || "this supplier"}'s ${c.quote.leadTimeDays}-day lead time.`,
          suggestion: `Ask ${c.quote.supplierName || "this supplier"} if lead time can be expedited, or use this gap to negotiate price.`,
        });
      }
    }
  }

  // --- Warranty: flag suppliers with no warranty stated when others have one.
  const withWarranty = contexts.filter((c) => c.quote.warranty && c.quote.warranty.trim().length > 0);
  const withoutWarranty = contexts.filter((c) => !c.quote.warranty && c.quote.unitPrice != null);
  if (withWarranty.length > 0 && withoutWarranty.length > 0) {
    for (const c of withoutWarranty) {
      insights.push({
        id: nextId(),
        supplierId: c.quote.id,
        supplierName: c.quote.supplierName,
        category: "warranty",
        observation: `${withWarranty[0].quote.supplierName || "Another supplier"} states a warranty (${withWarranty[0].quote.warranty}); ${c.quote.supplierName || "this supplier"} does not specify one.`,
        suggestion: `Ask ${c.quote.supplierName || "this supplier"} to clarify or add warranty coverage.`,
      });
    }
  }

  return insights;
}
