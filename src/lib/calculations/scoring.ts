import type { ScoringWeights, SupplierQuote, WEIGHT_KEYS } from "@/lib/types";
import type { LandedCostResult } from "./landed-cost";
import { paymentTermsLabel } from "./payment-terms";

export type ScoreFactor = keyof ScoringWeights;

export interface FactorScore {
  factor: ScoreFactor;
  label: string;
  /** Human-readable raw value used as the basis for this factor's score. */
  rawValueLabel: string;
  /** 0-100, where 100 is best among the compared suppliers for this factor. */
  normalizedScore: number;
  weight: number;
  /** normalizedScore * (weight / 100) — this supplier's points earned from this factor. */
  contribution: number;
  /** Set when a default/assumption was applied because data was missing. */
  assumptionNote: string | null;
}

export interface SupplierScore {
  supplierId: string;
  supplierName: string;
  factors: FactorScore[];
  totalScore: number;
}

/** Min-max normalize where the LOWEST raw value scores 100 (e.g. cost, lead time). */
function normalizeLowerIsBetter(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 100);
  return values.map((v) => (100 * (max - v)) / (max - min));
}

/** Min-max normalize where the HIGHEST raw value scores 100 (e.g. payment-terms value). */
function normalizeHigherIsBetter(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 100);
  return values.map((v) => (100 * (v - min)) / (max - min));
}

export interface ScoringInput {
  quote: SupplierQuote;
  landedCost: LandedCostResult;
}

export function calcWeightedScores(inputs: ScoringInput[], weights: ScoringWeights): SupplierScore[] {
  const n = inputs.length;
  if (n === 0) return [];

  // ---- Price: lower effective unit cost is better. Missing cost data -> worst (0), flagged.
  const priceValues = inputs.map((i) => i.landedCost.effectiveUnitCost);
  const knownPrice = priceValues.filter((v): v is number => v != null);
  const priceNorm = knownPrice.length > 0 ? normalizeLowerIsBetter(knownPrice) : [];
  let priceIdx = 0;

  // ---- Lead time: lower days is better. Missing -> worst (0), flagged.
  const leadValues = inputs.map((i) => i.quote.leadTimeDays);
  const knownLead = leadValues.filter((v): v is number => v != null);
  const leadNorm = knownLead.length > 0 ? normalizeLowerIsBetter(knownLead) : [];
  let leadIdx = 0;

  // ---- Payment terms: higher dollar value of delayed payment is better.
  const paymentValues = inputs.map((i) => i.landedCost.paymentTermsValue);
  const paymentNorm = normalizeHigherIsBetter(paymentValues);

  // ---- Reliability: user-entered 1-5 rating. Missing -> neutral 50, flagged.
  // ---- Flexibility: shorter/no contract commitment is better. Missing -> assumed 0 (month-to-month), flagged.
  const contractValues = inputs.map((i) => i.quote.contractLengthMonths ?? 0);
  const flexNorm = normalizeLowerIsBetter(contractValues);

  return inputs.map((input, idx) => {
    const factors: FactorScore[] = [];

    // Price
    if (input.landedCost.effectiveUnitCost != null) {
      factors.push({
        factor: "price",
        label: "Price (effective unit cost)",
        rawValueLabel: formatCurrency(input.landedCost.effectiveUnitCost),
        normalizedScore: priceNorm[priceIdx++],
        weight: weights.price,
        contribution: (priceNorm[priceIdx - 1] * weights.price) / 100,
        assumptionNote: null,
      });
    } else {
      factors.push({
        factor: "price",
        label: "Price (effective unit cost)",
        rawValueLabel: "Unknown",
        normalizedScore: 0,
        weight: weights.price,
        contribution: 0,
        assumptionNote: "Unit price not provided — scored as lowest (0) until specified.",
      });
    }

    // Lead time
    if (input.quote.leadTimeDays != null) {
      factors.push({
        factor: "leadTime",
        label: "Lead time",
        rawValueLabel: `${input.quote.leadTimeDays} days`,
        normalizedScore: leadNorm[leadIdx++],
        weight: weights.leadTime,
        contribution: (leadNorm[leadIdx - 1] * weights.leadTime) / 100,
        assumptionNote: null,
      });
    } else {
      factors.push({
        factor: "leadTime",
        label: "Lead time",
        rawValueLabel: "Unknown",
        normalizedScore: 0,
        weight: weights.leadTime,
        contribution: 0,
        assumptionNote: "Lead time not provided — scored as lowest (0) until specified.",
      });
    }

    // Payment terms
    factors.push({
      factor: "paymentTerms",
      label: "Payment terms",
      rawValueLabel: `${paymentTermsLabel(input.quote.paymentTerms)} (${formatCurrency(
        input.landedCost.paymentTermsValue
      )} value)`,
      normalizedScore: paymentNorm[idx],
      weight: weights.paymentTerms,
      contribution: (paymentNorm[idx] * weights.paymentTerms) / 100,
      assumptionNote:
        input.landedCost.paymentTermsValue === 0
          ? "No calculable financing value from these terms (due immediately or terms unspecified)."
          : null,
    });

    // Reliability
    if (input.quote.reliabilityRating != null) {
      const score = input.quote.reliabilityRating * 20;
      factors.push({
        factor: "reliability",
        label: "Reliability rating",
        rawValueLabel: `${input.quote.reliabilityRating} / 5`,
        normalizedScore: score,
        weight: weights.reliability,
        contribution: (score * weights.reliability) / 100,
        assumptionNote: null,
      });
    } else {
      factors.push({
        factor: "reliability",
        label: "Reliability rating",
        rawValueLabel: "Not rated",
        normalizedScore: 50,
        weight: weights.reliability,
        contribution: (50 * weights.reliability) / 100,
        assumptionNote: "No reliability rating provided — neutral score (50/100) used, not rewarded or penalized.",
      });
    }

    // Flexibility (contract commitment)
    const months = input.quote.contractLengthMonths;
    factors.push({
      factor: "flexibility",
      label: "Contract flexibility",
      rawValueLabel: months != null ? `${months}-month commitment` : "No contract specified",
      normalizedScore: flexNorm[idx],
      weight: weights.flexibility,
      contribution: (flexNorm[idx] * weights.flexibility) / 100,
      assumptionNote:
        months == null ? "Contract length not specified — assumed month-to-month (most flexible)." : null,
    });

    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);

    return {
      supplierId: input.quote.id,
      supplierName: input.quote.supplierName || "Untitled supplier",
      factors,
      totalScore,
    };
  });
}

function formatCurrency(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
