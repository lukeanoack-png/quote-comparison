import type { ScenarioAssumptions, ScoringWeights, SupplierQuote } from "@/lib/types";
import { buildComparison, type ComparisonResult, type SupplierComparison } from "./comparison";
import { COST_FIELD_LABELS, type CostFieldKey } from "./landed-cost";
import { paymentTermsLabel } from "./payment-terms";
import { rankScores, type FactorScore, type ScoreFactor, type SupplierScore } from "./scoring";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceReason {
  /** ok = supports the recommendation; warn = incomplete information; risk = could change the outcome. */
  tone: "ok" | "warn" | "risk";
  text: string;
}

export interface SensitivityCheck {
  supplierId: string;
  supplierName: string;
  /** Unknown cost fields and the conservative value substituted for each. */
  fills: { field: string; value: number; benchmarkSupplier: string }[];
  /** Unknown cost fields no other supplier quoted, so they couldn't be estimated. */
  untestable: string[];
  knownLandedCost: number;
  estimatedLandedCost: number;
}

export interface Decision {
  recommended: { score: SupplierScore; comparison: SupplierComparison } | null;
  runnerUp: { score: SupplierScore; comparison: SupplierComparison } | null;
  lowestCost: SupplierComparison | null;
  /** Recommended − lowest-cost total landed cost (0 when they're the same supplier). */
  costDifference: number | null;
  costDifferencePercent: number | null;
  /** Same difference across a year of orders at the scenario's orders/year. */
  annualizedCostDifference: number | null;
  /** One-sentence explanation of why the recommendation is or isn't the cheapest quote. */
  primaryTradeoff: string | null;
  /** Factors where the recommendation beats the lowest-cost quote, largest weighted advantage first. */
  advantages: string[];
  confidence: { level: ConfidenceLevel; reasons: ConfidenceReason[] };
  sensitivity: SensitivityCheck[];
  /** Whether the recommendation is unchanged when every unknown cost is estimated conservatively. */
  holdsUnderSensitivity: boolean | null;
  /** Short, factual cost/tradeoff observations for the analysis section. */
  observations: string[];
}

const usd0 = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function buildDecision(
  comparison: ComparisonResult,
  assumptions: ScenarioAssumptions,
  weights: ScoringWeights
): Decision {
  const byId = new Map(comparison.suppliers.map((s) => [s.quote.id, s]));
  const ranked = rankScores(comparison.scores).filter((s) => s.ineligibleReason == null);
  const pair = (score: SupplierScore | undefined) => (score ? { score, comparison: byId.get(score.supplierId)! } : null);

  const recommended = ranked.length >= 2 ? pair(ranked[0]) : null;
  const runnerUp = ranked.length >= 2 ? pair(ranked[1]) : null;
  const lowestCost = comparison.bestCostSupplierId ? byId.get(comparison.bestCostSupplierId) ?? null : null;

  const recPriced = recommended && recommended.comparison.landedCost.effectiveUnitCost != null;
  const costDifference =
    recommended && lowestCost && recPriced ? recommended.comparison.landedCost.totalLandedCost - lowestCost.landedCost.totalLandedCost : null;
  const costDifferencePercent =
    costDifference != null && lowestCost && lowestCost.landedCost.totalLandedCost > 0
      ? (costDifference / lowestCost.landedCost.totalLandedCost) * 100
      : null;
  const annualizedCostDifference =
    costDifference != null && assumptions.ordersPerYear > 0 ? costDifference * assumptions.ordersPerYear : null;

  // ---- Tradeoff vs. the lowest-cost quote
  let advantages: string[] = [];
  let primaryTradeoff: string | null = null;
  if (recommended && lowestCost) {
    const recName = recommended.score.supplierName;
    if (recommended.score.supplierId === lowestCost.quote.id) {
      primaryTradeoff = `${recName} is both the lowest landed cost and the highest weighted score, so there is no cost premium to justify.`;
    } else {
      const cheapScore = comparison.scores.find((s) => s.supplierId === lowestCost.quote.id);
      advantages = cheapScore ? describeAdvantages(recommended.score, cheapScore, recommended.comparison, lowestCost) : [];
      const cheapName = name(lowestCost);
      const premium =
        costDifference != null
          ? `costs ${usd0(costDifference)} (${costDifferencePercent?.toFixed(1)}%) more than ${cheapName} at ${assumptions.requiredQuantity.toLocaleString()} units`
          : `can't be cost-compared with ${cheapName}`;
      primaryTradeoff =
        advantages.length > 0
          ? `${recName} ${premium}, but ${joinList(advantages)}. At your current weights (price ${weights.price}%), those advantages outweigh the price gap.`
          : `${recName} ${premium}. It ranks higher on the other weighted factors combined.`;
    }
  }

  // ---- Sensitivity: estimate unknown cost components conservatively and re-run.
  const sensitivity = buildSensitivity(comparison);
  let holdsUnderSensitivity: boolean | null = null;
  const testable = sensitivity.filter((s) => s.fills.length > 0);
  if (recommended && testable.length > 0) {
    const filled = fillUnknownCosts(comparison, sensitivity);
    const rerun = buildComparison(filled, assumptions, weights);
    holdsUnderSensitivity = rerun.bestScoreSupplierId === recommended.score.supplierId;
  }

  const confidence = assessConfidence({ recommended, runnerUp, sensitivity, holdsUnderSensitivity });
  const observations = buildObservations(comparison);

  return {
    recommended,
    runnerUp,
    lowestCost,
    costDifference,
    costDifferencePercent,
    annualizedCostDifference,
    primaryTradeoff,
    advantages,
    confidence,
    sensitivity,
    holdsUnderSensitivity,
    observations,
  };
}

// ---------------------------------------------------------------------------

function describeAdvantages(
  rec: SupplierScore,
  cheap: SupplierScore,
  recC: SupplierComparison,
  cheapC: SupplierComparison
): string[] {
  const get = (s: SupplierScore, f: ScoreFactor) => s.factors.find((x) => x.factor === f) as FactorScore;
  const phrases: { weight: number; text: string }[] = [];

  for (const f of ["leadTime", "paymentTerms", "reliability", "flexibility"] as ScoreFactor[]) {
    const a = get(rec, f);
    const b = get(cheap, f);
    if (a.status !== "scored" || b.status !== "scored" || a.normalizedScore == null || b.normalizedScore == null) continue;
    const gap = a.normalizedScore - b.normalizedScore;
    if (gap <= 0 || a.weight === 0) continue;
    const weighted = gap * a.weight;
    switch (f) {
      case "leadTime": {
        const d = (cheapC.quote.leadTimeDays as number) - (recC.quote.leadTimeDays as number);
        phrases.push({ weight: weighted, text: `delivers ${d} days faster (${recC.quote.leadTimeDays} vs. ${cheapC.quote.leadTimeDays} days)` });
        break;
      }
      case "paymentTerms":
        phrases.push({
          weight: weighted,
          text: `offers ${paymentTermsLabel(recC.quote.paymentTerms)} vs. ${paymentTermsLabel(cheapC.quote.paymentTerms)}`,
        });
        break;
      case "reliability":
        phrases.push({ weight: weighted, text: `is rated ${recC.quote.reliabilityRating}/5 vs. ${cheapC.quote.reliabilityRating}/5 for reliability` });
        break;
      case "flexibility":
        phrases.push({
          weight: weighted,
          text: `requires a shorter commitment (${recC.quote.contractLengthMonths} vs. ${cheapC.quote.contractLengthMonths} months)`,
        });
        break;
    }
  }
  return phrases.sort((x, y) => y.weight - x.weight).map((p) => p.text);
}

const FILLABLE: CostFieldKey[] = ["shippingCost", "taxesFees", "setupFees", "otherFees"];

/** Value of a cost field at the scenario quantity (as used in landed cost). */
function scenarioValue(s: SupplierComparison, key: CostFieldKey): number | null {
  switch (key) {
    case "shippingCost":
      return s.landedCost.shippingCost;
    case "taxesFees":
      return s.landedCost.taxesFees;
    case "setupFees":
      return s.landedCost.setupFees;
    case "otherFees":
      return s.landedCost.otherFees;
    default:
      return null;
  }
}

function buildSensitivity(comparison: ComparisonResult): SensitivityCheck[] {
  const checks: SensitivityCheck[] = [];
  for (const s of comparison.suppliers) {
    if (s.landedCost.effectiveUnitCost == null) continue; // unpriced: no unit price, nothing to bound
    const missing = s.landedCost.missingCostKeys.filter((k) => FILLABLE.includes(k));
    if (missing.length === 0) continue;

    const fills: SensitivityCheck["fills"] = [];
    const untestable: string[] = [];
    for (const key of missing) {
      let best: { value: number; supplier: string } | null = null;
      for (const other of comparison.suppliers) {
        if (other.quote.id === s.quote.id) continue;
        const v = scenarioValue(other, key);
        if (v != null && (best == null || v > best.value)) best = { value: v, supplier: name(other) };
      }
      if (best) fills.push({ field: COST_FIELD_LABELS[key], value: best.value, benchmarkSupplier: best.supplier });
      else untestable.push(COST_FIELD_LABELS[key]);
    }
    const added = fills.reduce((sum, f) => sum + f.value, 0);
    checks.push({
      supplierId: s.quote.id,
      supplierName: name(s),
      fills,
      untestable,
      knownLandedCost: s.landedCost.totalLandedCost,
      // Approximation for display; the re-run comparison recalculates exactly (incl. payment-terms value).
      estimatedLandedCost: s.landedCost.totalLandedCost + added,
    });
  }
  return checks;
}

function fillUnknownCosts(comparison: ComparisonResult, checks: SensitivityCheck[]): SupplierQuote[] {
  return comparison.suppliers.map((s) => {
    const check = checks.find((c) => c.supplierId === s.quote.id);
    if (!check) return s.quote;
    const q: SupplierQuote = { ...s.quote };
    const qty = s.landedCost.quantity;
    // Scaled fields are stored at the quote's own quantity; convert the scenario-level estimate back.
    const toQuoteBasis = (v: number) => (s.landedCost.scalingApplied && qty > 0 ? (v * (s.quote.quantity as number)) / qty : v);
    for (const key of s.landedCost.missingCostKeys) {
      const fill = check.fills.find((f) => f.field === COST_FIELD_LABELS[key]);
      if (!fill) continue;
      if (key === "setupFees") q.setupFees = fill.value;
      else if (key === "shippingCost") q.shippingCost = toQuoteBasis(fill.value);
      else if (key === "taxesFees") q.taxesFees = toQuoteBasis(fill.value);
      else if (key === "otherFees") q.otherFees = toQuoteBasis(fill.value);
    }
    return q;
  });
}

function assessConfidence(args: {
  recommended: Decision["recommended"];
  runnerUp: Decision["runnerUp"];
  sensitivity: SensitivityCheck[];
  holdsUnderSensitivity: boolean | null;
}): Decision["confidence"] {
  const { recommended, runnerUp, sensitivity, holdsUnderSensitivity } = args;
  const reasons: ConfidenceReason[] = [];
  let level: ConfidenceLevel = "high";
  const lower = (to: ConfidenceLevel) => {
    if (to === "low" || (to === "medium" && level === "high")) level = to;
  };

  if (!recommended || !runnerUp) {
    return {
      level: "low",
      reasons: [
        {
          tone: "risk",
          text: "At least two suppliers need a unit price and enough scored factors (half of your priority weight) before a recommendation can be made.",
        },
      ],
    };
  }

  const rec = recommended.score;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // Data completeness of the top two.
  for (const s of [rec, runnerUp.score]) {
    const role = s === rec ? "Recommended supplier" : "Runner-up";
    if (s.coverage < 1) {
      // Below 70% coverage, the unknown factors could plausibly reverse the ranking.
      const thin = s.coverage < 0.7;
      reasons.push({
        tone: thin ? "risk" : "warn",
        text: `${role} ${s.supplierName} was scored on ${pct(s.coverage)} of your priority weight — ${s.unscoredFactors.join(", ").toLowerCase()} unknown.`,
      });
      lower(thin ? "low" : "medium");
    }
  }
  if (rec.coverage === 1) reasons.push({ tone: "ok", text: `Every weighted factor is known for ${rec.supplierName}.` });

  // Incomplete landed costs.
  for (const check of sensitivity) {
    const fields = [...check.fills.map((f) => f.field), ...check.untestable].join(", ").toLowerCase();
    const isRec = check.supplierId === rec.supplierId;
    if (check.fills.length > 0 && holdsUnderSensitivity === false) {
      reasons.push({
        tone: "risk",
        text: `${check.supplierName}'s landed cost excludes unknown ${fields}. If those match the highest amount another supplier quoted, the recommendation changes.`,
      });
      lower("low");
    } else if (check.untestable.length > 0) {
      reasons.push({
        tone: "warn",
        text: `${check.supplierName}'s landed cost excludes unknown ${fields}, and no other supplier quoted ${check.untestable.join(", ").toLowerCase()} to estimate from.`,
      });
      lower("medium");
    } else {
      const fill = check.fills.map((f) => `${f.field.toLowerCase()} at ${usd0(f.value)}`).join(", ");
      reasons.push({
        tone: "warn",
        text: `${check.supplierName}'s landed cost excludes unknown ${fields}, so its ${usd0(check.knownLandedCost)} is a minimum. The recommendation holds even if they match the highest quoted by another supplier (${fill}).`,
      });
      if (isRec) lower("medium");
    }
  }

  // Margin between first and second.
  const margin = (rec.totalScore ?? 0) - (runnerUp.score.totalScore ?? 0);
  if (margin < 2) {
    reasons.push({ tone: "risk", text: `Only ${margin.toFixed(1)} points ahead of ${runnerUp.score.supplierName} — a small change to weights or data could reverse the ranking.` });
    lower("low");
  } else if (margin < 5) {
    reasons.push({ tone: "warn", text: `${margin.toFixed(1)} points ahead of ${runnerUp.score.supplierName} — a narrow lead.` });
    lower("medium");
  } else {
    reasons.push({ tone: "ok", text: `Leads ${runnerUp.score.supplierName} by ${margin.toFixed(1)} points.` });
  }

  if (recommended.comparison.landedCost.belowMinimumOrderQuantity) {
    reasons.push({ tone: "risk", text: `Your required quantity is below ${rec.supplierName}'s minimum order quantity.` });
    lower("medium");
  }

  // Show problems first.
  const order = { risk: 0, warn: 1, ok: 2 } as const;
  reasons.sort((a, b) => order[a.tone] - order[b.tone]);
  return { level, reasons };
}

function buildObservations(comparison: ComparisonResult): string[] {
  const observations: string[] = [];
  const priced = comparison.suppliers
    .filter((s) => s.landedCost.effectiveUnitCost != null)
    .sort((a, b) => a.landedCost.totalLandedCost - b.landedCost.totalLandedCost);
  if (priced.length === 0) return ["No supplier has a unit price yet, so no landed cost can be calculated."];

  const cheapest = priced[0];
  const costLabel = (s: SupplierComparison) =>
    `${usd0(s.landedCost.totalLandedCost)}${s.landedCost.costComplete ? "" : " (minimum — some costs unknown)"}`;
  observations.push(`${name(cheapest)} has the lowest landed cost at ${costLabel(cheapest)}.`);

  for (const s of priced.slice(1)) {
    const gap = s.landedCost.totalLandedCost - cheapest.landedCost.totalLandedCost;
    const atLeast = s.landedCost.costComplete ? "" : "at least ";
    const offsets: string[] = [];
    if (s.quote.leadTimeDays != null && cheapest.quote.leadTimeDays != null && s.quote.leadTimeDays < cheapest.quote.leadTimeDays) {
      offsets.push(`${cheapest.quote.leadTimeDays - s.quote.leadTimeDays} days faster delivery`);
    }
    if (s.landedCost.paymentTermsValue > cheapest.landedCost.paymentTermsValue && s.quote.paymentTerms.netDays != null) {
      offsets.push(`longer payment terms (${paymentTermsLabel(s.quote.paymentTerms)})`);
    }
    if (s.quote.reliabilityRating != null && cheapest.quote.reliabilityRating != null && s.quote.reliabilityRating > cheapest.quote.reliabilityRating) {
      offsets.push(`a higher reliability rating (${s.quote.reliabilityRating}/5)`);
    }
    observations.push(
      offsets.length > 0
        ? `${name(s)} costs ${atLeast}${usd0(gap)} more, offset by ${joinList(offsets)}.`
        : `${name(s)} costs ${atLeast}${usd0(gap)} more with no offsetting advantage in the quoted terms.`
    );
  }
  for (const s of comparison.suppliers.filter((x) => x.landedCost.effectiveUnitCost == null)) {
    observations.push(`${name(s)} has no unit price, so it can't be cost-compared.`);
  }
  return observations;
}

function name(s: SupplierComparison): string {
  return s.quote.supplierName || "Untitled supplier";
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
