import type { ComparisonResult, SupplierComparison } from "./comparison";
import type { SupplierScore } from "./scoring";

export interface DealAnalysis {
  /** Factual, data-grounded observations about cost and tradeoffs. */
  observations: string[];
  /** The recommendation sentence, or null if there isn't enough data to recommend. */
  recommendation: string | null;
  recommendedSupplierId: string | null;
  /** Why the recommended supplier won, broken down by factor. */
  reasons: { label: string; detail: string }[];
}

const currency = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function buildDealAnalysis(comparison: ComparisonResult): DealAnalysis {
  const observations: string[] = [];
  const priced = comparison.suppliers
    .filter((s) => s.landedCost.effectiveUnitCost != null)
    .sort((a, b) => a.landedCost.totalLandedCost - b.landedCost.totalLandedCost);

  if (priced.length === 0) {
    return {
      observations: ["No supplier has enough cost data (unit price at minimum) to calculate a total landed cost yet."],
      recommendation: null,
      recommendedSupplierId: null,
      reasons: [],
    };
  }

  const cheapest = priced[0];
  const cheapestName = displayName(cheapest);

  if (priced.length >= 2) {
    const second = priced[1];
    const pct = second.landedCost.totalLandedCost > 0
      ? ((second.landedCost.totalLandedCost - cheapest.landedCost.totalLandedCost) / second.landedCost.totalLandedCost) * 100
      : 0;
    observations.push(
      `${cheapestName} has the lowest total landed cost at ${currency(cheapest.landedCost.totalLandedCost)}, approximately ${pct.toFixed(1)}% below ${displayName(second)} (${currency(second.landedCost.totalLandedCost)}).`
    );
  }

  // Tradeoff sentences for every other priced supplier vs. the cheapest.
  for (const s of priced.slice(1)) {
    const tradeoffs: string[] = [];
    const costGap = s.landedCost.totalLandedCost - cheapest.landedCost.totalLandedCost;

    if (s.quote.leadTimeDays != null && cheapest.quote.leadTimeDays != null) {
      const leadGap = cheapest.quote.leadTimeDays - s.quote.leadTimeDays;
      if (leadGap > 0) tradeoffs.push(`${leadGap}-day faster lead time`);
    }
    if (s.quote.paymentTerms.netDays != null && cheapest.quote.paymentTerms.netDays != null) {
      if (s.quote.paymentTerms.netDays > cheapest.quote.paymentTerms.netDays) {
        tradeoffs.push(`Net ${s.quote.paymentTerms.netDays} payment terms (vs. Net ${cheapest.quote.paymentTerms.netDays})`);
      }
    }
    if (s.quote.warranty && !cheapest.quote.warranty) {
      tradeoffs.push(`a stated warranty (${s.quote.warranty})`);
    }

    if (tradeoffs.length > 0 && costGap > 0) {
      observations.push(
        `${displayName(s)} is ${currency(costGap)} more expensive than ${cheapestName} but offers ${joinList(tradeoffs)}.`
      );
    } else if (costGap > 0) {
      observations.push(`${displayName(s)} is ${currency(costGap)} more expensive than ${cheapestName} with no offsetting terms identified in the quote.`);
    }
  }

  // Recommendation from weighted score, only when at least 2 suppliers are scoreable.
  const sortedScores = [...comparison.scores].sort((a, b) => b.totalScore - a.totalScore);
  let recommendation: string | null = null;
  let recommendedSupplierId: string | null = null;
  let reasons: { label: string; detail: string }[] = [];

  if (sortedScores.length >= 2) {
    const winner = sortedScores[0];
    const runnerUp = sortedScores[1];
    recommendedSupplierId = winner.supplierId;
    recommendation = `Based on your current priorities, ${winner.supplierName} offers the strongest overall weighted score (${winner.totalScore.toFixed(1)} vs. ${runnerUp.totalScore.toFixed(1)} for ${runnerUp.supplierName}).`;

    reasons = winner.factors
      .filter((f) => f.weight > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .map((f) => ({
        label: f.label,
        detail: `${f.rawValueLabel} — scored ${f.normalizedScore.toFixed(0)}/100, contributing ${f.contribution.toFixed(1)} pts at ${f.weight}% weight.${f.assumptionNote ? ` (${f.assumptionNote})` : ""}`,
      }));
  } else if (sortedScores.length === 1) {
    recommendedSupplierId = sortedScores[0].supplierId;
    recommendation = `${sortedScores[0].supplierName} is the only supplier with enough data to score. Add more quotes for a meaningful comparison.`;
  }

  return { observations, recommendation, recommendedSupplierId, reasons };
}

function displayName(s: SupplierComparison): string {
  return s.quote.supplierName || "Untitled supplier";
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
