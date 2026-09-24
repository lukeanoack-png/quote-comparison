import type { ScenarioAssumptions, SupplierQuote, VolumeDiscountTier } from "@/lib/types";
import { calcPaymentTermsValue } from "./payment-terms";

export interface ApplicableDiscount {
  tier: VolumeDiscountTier;
  percent: number;
}

/** The best volume-discount tier that applies at the given quantity, if any. */
export function getApplicableDiscount(
  volumeDiscounts: VolumeDiscountTier[],
  quantity: number
): ApplicableDiscount | null {
  const eligible = volumeDiscounts.filter((t) => quantity >= t.minQuantity);
  if (eligible.length === 0) return null;
  const best = eligible.reduce((a, b) => (b.discountPercent > a.discountPercent ? b : a));
  return { tier: best, percent: best.discountPercent };
}

export interface LandedCostResult {
  supplierId: string;
  /** Quantity used for this calculation (the scenario's required quantity). */
  quantity: number;

  /** unitPrice * quantity, before any volume discount. Null if unitPrice is unknown. */
  grossBaseCost: number | null;
  discountApplied: ApplicableDiscount | null;
  discountAmount: number;
  /** grossBaseCost - discountAmount. */
  basePurchaseCost: number | null;

  /** Shipping/taxes/other fees, scaled to the scenario quantity (see scalingApplied). */
  shippingCost: number | null;
  taxesFees: number | null;
  setupFees: number | null;
  otherFees: number | null;

  /**
   * True if shipping/taxes/other fees were scaled proportionally from the quote's
   * original quantity to the scenario quantity. False (and unscaled) when the
   * quote didn't specify an original quantity to scale from.
   */
  scalingApplied: boolean;

  /** Dollar value of delayed payment (time value of money). Positive = economic benefit. */
  paymentTermsValue: number;

  /** Sum of all known cost components (unknown components excluded, not zeroed). */
  subtotalKnownCosts: number;
  /** subtotalKnownCosts - paymentTermsValue. The headline comparison number. */
  totalLandedCost: number;
  /** totalLandedCost / quantity. */
  effectiveUnitCost: number | null;

  /** Which cost fields were not provided on the quote (unknown, not assumed zero). */
  missingFields: string[];
  /** Same as missingFields, as SupplierQuote keys. */
  missingCostKeys: CostFieldKey[];
  /**
   * False when any cost component is unknown. Unknown components are excluded
   * (never assumed zero), so an incomplete totalLandedCost is a lower bound.
   */
  costComplete: boolean;
  /** True if quantity is below the supplier's stated minimum order quantity. */
  belowMinimumOrderQuantity: boolean;
  moqShortfall: number | null;
}

export type CostFieldKey = "unitPrice" | "shippingCost" | "taxesFees" | "setupFees" | "otherFees";

export const COST_FIELD_LABELS: Record<CostFieldKey, string> = {
  unitPrice: "Unit price",
  shippingCost: "Shipping cost",
  taxesFees: "Taxes / fees",
  setupFees: "Setup fee",
  otherFees: "Other fees",
};

export function calcLandedCost(
  quote: SupplierQuote,
  assumptions: ScenarioAssumptions
): LandedCostResult {
  const quantity = assumptions.requiredQuantity;
  const missingCostKeys: CostFieldKey[] = [];

  const grossBaseCost = quote.unitPrice != null ? quote.unitPrice * quantity : null;
  if (quote.unitPrice == null) missingCostKeys.push("unitPrice");

  const discountApplied = getApplicableDiscount(quote.volumeDiscounts, quantity);
  const discountAmount =
    grossBaseCost != null && discountApplied ? grossBaseCost * (discountApplied.percent / 100) : 0;
  const basePurchaseCost = grossBaseCost != null ? grossBaseCost - discountAmount : null;

  // Shipping, taxes, and other fees were quoted at the supplier's original
  // quantity. We scale them proportionally to the scenario quantity so that
  // scenario analysis (changing required quantity) produces realistic
  // economics instead of holding these costs artificially flat. Setup fees
  // are one-time and are never scaled.
  const scalingApplied = quote.quantity != null && quote.quantity > 0;
  const scaleFactor = scalingApplied ? quantity / (quote.quantity as number) : 1;
  const scaledShipping = quote.shippingCost != null ? quote.shippingCost * scaleFactor : null;
  const scaledTaxes = quote.taxesFees != null ? quote.taxesFees * scaleFactor : null;
  const scaledOther = quote.otherFees != null ? quote.otherFees * scaleFactor : null;

  if (quote.shippingCost == null) missingCostKeys.push("shippingCost");
  if (quote.taxesFees == null) missingCostKeys.push("taxesFees");
  if (quote.setupFees == null) missingCostKeys.push("setupFees");
  if (quote.otherFees == null) missingCostKeys.push("otherFees");

  const knownComponents = [basePurchaseCost, scaledShipping, scaledTaxes, quote.setupFees, scaledOther];
  const subtotalKnownCosts = knownComponents.reduce((sum: number, v) => sum + (v ?? 0), 0);

  const paymentTermsValue = calcPaymentTermsValue(
    subtotalKnownCosts,
    quote.paymentTerms,
    assumptions.annualCostOfCapitalPercent
  );

  const totalLandedCost = subtotalKnownCosts - paymentTermsValue;
  // Without a unit price there is no purchase cost to compare, so the quote
  // can't be priced at all (a total made only of fees would look artificially cheap).
  const effectiveUnitCost = quantity > 0 && basePurchaseCost != null ? totalLandedCost / quantity : null;

  const belowMinimumOrderQuantity =
    quote.minimumOrderQuantity != null && quantity < quote.minimumOrderQuantity;
  const moqShortfall = belowMinimumOrderQuantity
    ? (quote.minimumOrderQuantity as number) - quantity
    : null;

  return {
    supplierId: quote.id,
    quantity,
    grossBaseCost,
    discountApplied,
    discountAmount,
    basePurchaseCost,
    shippingCost: scaledShipping,
    taxesFees: scaledTaxes,
    setupFees: quote.setupFees,
    otherFees: scaledOther,
    scalingApplied,
    paymentTermsValue,
    subtotalKnownCosts,
    totalLandedCost,
    effectiveUnitCost,
    missingFields: missingCostKeys.map((k) => COST_FIELD_LABELS[k]),
    missingCostKeys,
    costComplete: missingCostKeys.length === 0,
    belowMinimumOrderQuantity,
    moqShortfall,
  };
}

/** Annualized recurring cost (setup amortized + recurring fees), shown separately from landed cost. */
export function calcAnnualRecurringCost(
  quote: SupplierQuote,
  assumptions: ScenarioAssumptions
): number | null {
  if (quote.recurringFees == null) return null;
  const periodsPerYear = quote.recurringFeePeriod === "month" ? 12 : 1;
  return quote.recurringFees * periodsPerYear;
}

export function dollarDiff(value: number, best: number): number {
  return value - best;
}

export function percentDiff(value: number, best: number): number {
  if (best === 0) return 0;
  return ((value - best) / best) * 100;
}
