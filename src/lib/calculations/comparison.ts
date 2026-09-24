import type { ScenarioAssumptions, ScoringWeights, SupplierQuote } from "@/lib/types";
import { calcAnnualRecurringCost, calcLandedCost, dollarDiff, percentDiff, type LandedCostResult } from "./landed-cost";
import { calcWeightedScores, rankScores, type FactorMethod, type SupplierScore } from "./scoring";

export interface SupplierComparison {
  quote: SupplierQuote;
  landedCost: LandedCostResult;
  annualRecurringCost: number | null;
  dollarDiffFromBest: number;
  percentDiffFromBest: number;
  isLowestCost: boolean;
}

export interface ComparisonResult {
  suppliers: SupplierComparison[];
  scores: SupplierScore[];
  scoringMethods: FactorMethod[];
  /** Lowest total landed cost among suppliers that can be priced (have a unit price). */
  bestCostSupplierId: string | null;
  /** Highest weighted score among suppliers eligible for recommendation. */
  bestScoreSupplierId: string | null;
}

export function buildComparison(
  quotes: SupplierQuote[],
  assumptions: ScenarioAssumptions,
  weights: ScoringWeights
): ComparisonResult {
  const landedCosts = quotes.map((q) => calcLandedCost(q, assumptions));
  const validCosts = landedCosts.filter((lc) => lc.effectiveUnitCost != null).map((lc) => lc.totalLandedCost);
  const bestCost = validCosts.length > 0 ? Math.min(...validCosts) : null;

  const suppliers: SupplierComparison[] = quotes.map((quote, idx) => {
    const landedCost = landedCosts[idx];
    const priced = bestCost != null && landedCost.effectiveUnitCost != null;
    return {
      quote,
      landedCost,
      annualRecurringCost: calcAnnualRecurringCost(quote, assumptions),
      dollarDiffFromBest: priced ? dollarDiff(landedCost.totalLandedCost, bestCost) : 0,
      percentDiffFromBest: priced ? percentDiff(landedCost.totalLandedCost, bestCost) : 0,
      isLowestCost: priced && landedCost.totalLandedCost === bestCost,
    };
  });

  const { scores, methods } = calcWeightedScores(
    quotes.map((quote, idx) => ({ quote, landedCost: landedCosts[idx] })),
    weights
  );

  const bestCostSupplierId =
    suppliers
      .filter((s) => s.landedCost.effectiveUnitCost != null)
      .sort((a, b) => a.landedCost.totalLandedCost - b.landedCost.totalLandedCost)[0]?.quote.id ?? null;

  const top = rankScores(scores)[0];
  const bestScoreSupplierId = top && top.ineligibleReason == null ? top.supplierId : null;

  return { suppliers, scores, scoringMethods: methods, bestCostSupplierId, bestScoreSupplierId };
}
