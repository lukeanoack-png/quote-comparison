import type { ScenarioAssumptions, ScoringWeights, SupplierQuote } from "@/lib/types";
import { calcAnnualRecurringCost, calcLandedCost, dollarDiff, percentDiff, type LandedCostResult } from "./landed-cost";
import { calcWeightedScores, type SupplierScore } from "./scoring";

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
  bestCostSupplierId: string | null;
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
    const annualRecurringCost = calcAnnualRecurringCost(quote, assumptions);
    const diffDollar = bestCost != null && landedCost.effectiveUnitCost != null ? dollarDiff(landedCost.totalLandedCost, bestCost) : 0;
    const diffPercent = bestCost != null && landedCost.effectiveUnitCost != null ? percentDiff(landedCost.totalLandedCost, bestCost) : 0;
    return {
      quote,
      landedCost,
      annualRecurringCost,
      dollarDiffFromBest: diffDollar,
      percentDiffFromBest: diffPercent,
      isLowestCost: bestCost != null && landedCost.totalLandedCost === bestCost,
    };
  });

  const scores = calcWeightedScores(
    quotes.map((quote, idx) => ({ quote, landedCost: landedCosts[idx] })),
    weights
  );

  const bestCostSupplierId =
    suppliers.filter((s) => s.landedCost.effectiveUnitCost != null).sort((a, b) => a.landedCost.totalLandedCost - b.landedCost.totalLandedCost)[0]
      ?.quote.id ?? null;

  const bestScoreSupplierId =
    [...scores].sort((a, b) => b.totalScore - a.totalScore)[0]?.supplierId ?? null;

  return { suppliers, scores, bestCostSupplierId, bestScoreSupplierId };
}
