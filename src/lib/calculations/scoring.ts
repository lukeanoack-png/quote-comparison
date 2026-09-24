import { WEIGHT_KEYS, type ScoringWeights, type SupplierQuote } from "@/lib/types";
import type { LandedCostResult } from "./landed-cost";
import { isPaymentTermsQuantifiable, paymentTermsLabel } from "./payment-terms";

/**
 * Weighted scoring.
 *
 * 1. Each factor's raw value is converted to a 0–100 score:
 *    - Relative factors (price, lead time, payment terms) use min–max
 *      normalization across the suppliers that provided a value: the best
 *      value scores 100, the worst 0, and everything else is placed on a
 *      straight line between them.
 *    - Absolute factors (reliability, contract flexibility) use a fixed scale,
 *      so a single supplier's value still means something on its own.
 * 2. Missing information is never scored. A factor with no value is marked
 *    "Unknown — not scored" and its weight is redistributed proportionally
 *    across that supplier's known factors:
 *
 *      score = Σ(factorScore × weight) ÷ Σ(weight of scored factors)
 *
 *    `coverage` records how much of the total priority weight was actually
 *    scored, so a score built on partial data is never presented as complete.
 * 3. A relative factor needs at least two suppliers with a value; with only
 *    one there is nothing to compare against, so nobody is scored on it.
 * 4. Redistribution must not let thin data win: a supplier is only eligible to
 *    be recommended if it has a unit price and at least half of the priority
 *    weight could be scored.
 */

export const MIN_COVERAGE_FOR_RECOMMENDATION = 0.5;

export type ScoreFactor = keyof ScoringWeights;
export type FactorStatus = "scored" | "unknown" | "not-comparable";

export interface FactorScore {
  factor: ScoreFactor;
  label: string;
  rawValue: number | null;
  /** Human-readable raw value used as the basis for this factor's score. */
  rawValueLabel: string;
  status: FactorStatus;
  /** 0–100 where 100 is best; null when not scored. */
  normalizedScore: number | null;
  /** The user's priority weight for this factor. */
  weight: number;
  /** Weight after redistributing unscored factors (sums to 100 across scored factors). 0 when not scored. */
  effectiveWeight: number;
  /** normalizedScore × effectiveWeight / 100 — points earned toward the 0–100 total. */
  contribution: number;
  /** Worked arithmetic for this supplier, e.g. "100 × ($22.51 − $21.09) ÷ ($22.51 − $20.52) = 71". */
  calculation: string | null;
  /** Caveat, e.g. why it wasn't scored or that its cost basis is incomplete. */
  note: string | null;
}

export interface SupplierScore {
  supplierId: string;
  supplierName: string;
  factors: FactorScore[];
  /** 0–100 over the factors that could be scored; null if none could. */
  totalScore: number | null;
  /** Share (0–1) of total priority weight that was scored. 1 = complete. */
  coverage: number;
  /** Labels of weighted factors that could not be scored. */
  unscoredFactors: string[];
  /** Whether landed cost includes every cost component. */
  costComplete: boolean;
  /** Null when eligible to be recommended; otherwise why not. */
  ineligibleReason: string | null;
}

/** How a factor is converted to 0–100, with the actual endpoints used. */
export interface FactorMethod {
  factor: ScoreFactor;
  label: string;
  weight: number;
  rule: string;
  /** e.g. "$20.52 → 100 · $22.51 → 0" */
  scale: string;
  comparable: boolean;
  note: string | null;
}

export interface ScoringResult {
  scores: SupplierScore[];
  methods: FactorMethod[];
}

export interface ScoringInput {
  quote: SupplierQuote;
  landedCost: LandedCostResult;
}

type Scale =
  | { kind: "relative"; lowerIsBetter: boolean; fmt: (v: number) => string }
  | { kind: "absolute"; score: (v: number) => number; formula: (v: number) => string; scale: string };

interface FactorDef {
  factor: ScoreFactor;
  label: string;
  rule: string;
  value: (i: ScoringInput) => number | null;
  valueLabel: (i: ScoringInput, v: number | null) => string;
  unknownNote: (i: ScoringInput) => string;
  note?: (i: ScoringInput) => string | null;
  scale: Scale;
}

const FLEX_HORIZON_MONTHS = 24;

const FACTORS: FactorDef[] = [
  {
    factor: "price",
    label: "Price (effective unit cost)",
    rule: "Lower is better. Effective unit cost = total landed cost ÷ required quantity.",
    value: (i) => i.landedCost.effectiveUnitCost,
    valueLabel: (_i, v) => (v != null ? usd(v, 2) : "Unknown"),
    unknownNote: () => "No unit price, so landed cost can't be calculated.",
    note: (i) =>
      i.landedCost.effectiveUnitCost != null && !i.landedCost.costComplete
        ? `Excludes unknown ${i.landedCost.missingFields.join(", ").toLowerCase()} — true cost may be higher, so this score may be overstated.`
        : null,
    scale: { kind: "relative", lowerIsBetter: true, fmt: (v) => usd(v, 2) },
  },
  {
    factor: "leadTime",
    label: "Lead time",
    rule: "Lower is better. Days from order to delivery, as quoted.",
    value: (i) => i.quote.leadTimeDays,
    valueLabel: (_i, v) => (v != null ? `${v} days` : "Unknown"),
    unknownNote: () => "Lead time not stated.",
    scale: { kind: "relative", lowerIsBetter: true, fmt: (v) => `${v}` },
  },
  {
    factor: "paymentTerms",
    label: "Payment terms",
    rule: "Higher is better. Dollar value of paying later, at your cost of capital.",
    // Needs a priced quote too: without a unit price the value would be computed on fees alone.
    value: (i) =>
      isPaymentTermsQuantifiable(i.quote.paymentTerms) && i.landedCost.effectiveUnitCost != null ? i.landedCost.paymentTermsValue : null,
    valueLabel: (i, v) => (v != null ? `${paymentTermsLabel(i.quote.paymentTerms)} · ${usd(v, 0)} value` : paymentTermsLabel(i.quote.paymentTerms)),
    unknownNote: (i) =>
      i.landedCost.effectiveUnitCost == null
        ? "No unit price, so the value of the payment terms can't be calculated."
        : "Payment terms don't state enough (e.g. number of days) to calculate a value.",
    scale: { kind: "relative", lowerIsBetter: false, fmt: (v) => usd(v, 0) },
  },
  {
    factor: "reliability",
    label: "Reliability rating",
    rule: "Your 1–5 rating on a fixed scale: rating × 20.",
    value: (i) => i.quote.reliabilityRating,
    valueLabel: (_i, v) => (v != null ? `${v} / 5` : "Not rated"),
    unknownNote: () => "No reliability rating entered.",
    scale: { kind: "absolute", score: (v) => v * 20, formula: (v) => `${v} × 20`, scale: "1/5 → 20 · 5/5 → 100" },
  },
  {
    factor: "flexibility",
    label: "Contract flexibility",
    rule: `Shorter commitment is better, on a fixed scale: 100 × (1 − months ÷ ${FLEX_HORIZON_MONTHS}), floored at 0.`,
    value: (i) => i.quote.contractLengthMonths,
    valueLabel: (_i, v) => (v == null ? "Unknown" : v === 0 ? "No commitment" : `${v}-month commitment`),
    unknownNote: () => "Contract length not stated — not assumed to be month-to-month.",
    scale: {
      kind: "absolute",
      score: (v) => 100 * (1 - Math.min(v, FLEX_HORIZON_MONTHS) / FLEX_HORIZON_MONTHS),
      formula: (v) => `100 × (1 − ${Math.min(v, FLEX_HORIZON_MONTHS)} ÷ ${FLEX_HORIZON_MONTHS})`,
      scale: `No commitment → 100 · ${FLEX_HORIZON_MONTHS}+ months → 0`,
    },
  },
];

interface RawFactorResult {
  status: FactorStatus;
  score: number | null;
  calculation: string | null;
}

export function calcWeightedScores(inputs: ScoringInput[], weights: ScoringWeights): ScoringResult {
  const totalWeight = WEIGHT_KEYS.reduce((sum, k) => sum + weights[k], 0);
  const methods: FactorMethod[] = [];
  // perFactor[f][supplierIdx]
  const perFactor: RawFactorResult[][] = [];

  for (const def of FACTORS) {
    const values = inputs.map((i) => def.value(i));
    const known = values.filter((v): v is number => v != null);
    const results: RawFactorResult[] = [];

    if (def.scale.kind === "absolute") {
      const scale = def.scale;
      for (const v of values) {
        if (v == null) results.push({ status: "unknown", score: null, calculation: null });
        else {
          const score = clamp(scale.score(v));
          results.push({ status: "scored", score, calculation: `${scale.formula(v)} = ${score.toFixed(0)}` });
        }
      }
      methods.push({ factor: def.factor, label: def.label, weight: weights[def.factor], rule: def.rule, scale: scale.scale, comparable: true, note: null });
    } else {
      const { lowerIsBetter, fmt } = def.scale;
      const comparable = known.length >= 2;
      const min = Math.min(...known);
      const max = Math.max(...known);
      const best = lowerIsBetter ? min : max;
      const worst = lowerIsBetter ? max : min;

      for (const v of values) {
        if (v == null) {
          results.push({ status: "unknown", score: null, calculation: null });
        } else if (!comparable) {
          results.push({ status: "not-comparable", score: null, calculation: null });
        } else if (max === min) {
          results.push({ status: "scored", score: 100, calculation: "All quoted values are equal → 100" });
        } else {
          const score = lowerIsBetter ? (100 * (max - v)) / (max - min) : (100 * (v - min)) / (max - min);
          const calculation = lowerIsBetter
            ? `100 × (${fmt(max)} − ${fmt(v)}) ÷ (${fmt(max)} − ${fmt(min)}) = ${score.toFixed(0)}`
            : `100 × (${fmt(v)} − ${fmt(min)}) ÷ (${fmt(max)} − ${fmt(min)}) = ${score.toFixed(0)}`;
          results.push({ status: "scored", score, calculation });
        }
      }
      methods.push({
        factor: def.factor,
        label: def.label,
        weight: weights[def.factor],
        rule: def.rule,
        scale: comparable ? (max === min ? `All ${fmt(min)} → 100` : `${fmt(best)} → 100 · ${fmt(worst)} → 0`) : "—",
        comparable,
        note: comparable
          ? null
          : known.length === 1
            ? "Only one supplier provided this, so there is nothing to compare against. Not scored for anyone."
            : "No supplier provided this. Not scored.",
      });
    }
    perFactor.push(results);
  }

  const scores = inputs.map((input, idx) => {
    const scoredWeight = FACTORS.reduce(
      (sum, def, f) => sum + (perFactor[f][idx].status === "scored" ? weights[def.factor] : 0),
      0
    );

    const factors: FactorScore[] = FACTORS.map((def, f) => {
      const r = perFactor[f][idx];
      const weight = weights[def.factor];
      const effectiveWeight = r.status === "scored" && scoredWeight > 0 ? (weight / scoredWeight) * 100 : 0;
      const raw = def.value(input);
      return {
        factor: def.factor,
        label: def.label,
        rawValue: raw,
        rawValueLabel: def.valueLabel(input, raw),
        status: r.status,
        normalizedScore: r.score,
        weight,
        effectiveWeight,
        contribution: r.score != null ? (r.score * effectiveWeight) / 100 : 0,
        calculation: r.calculation,
        note:
          r.status === "unknown"
            ? def.unknownNote(input)
            : r.status === "not-comparable"
              ? "Only this supplier provided a value — nothing to compare against."
              : (def.note?.(input) ?? null),
      };
    });

    return {
      supplierId: input.quote.id,
      supplierName: input.quote.supplierName || "Untitled supplier",
      factors,
      totalScore: scoredWeight > 0 ? factors.reduce((sum, fs) => sum + fs.contribution, 0) : null,
      coverage: totalWeight > 0 ? scoredWeight / totalWeight : 0,
      unscoredFactors: factors.filter((fs) => fs.status !== "scored" && fs.weight > 0).map((fs) => shortFactorLabel(fs.factor)),
      costComplete: input.landedCost.costComplete,
      ineligibleReason: null as string | null,
    };
  });

  for (const s of scores) {
    const coverage = s.coverage;
    if (s.totalScore == null) s.ineligibleReason = "Not enough information to score.";
    else if (s.factors.find((f) => f.factor === "price")?.rawValue == null) s.ineligibleReason = "No unit price — can't be recommended until priced.";
    else if (coverage < MIN_COVERAGE_FOR_RECOMMENDATION)
      s.ineligibleReason = `Only ${Math.round(coverage * 100)}% of priority weight could be scored — too little to recommend.`;
  }

  return { scores, methods };
}

/** Eligible suppliers by score (best first), then ineligible ones. */
export function rankScores(scores: SupplierScore[]): SupplierScore[] {
  return [...scores].sort((a, b) => {
    const ea = a.ineligibleReason == null ? 1 : 0;
    const eb = b.ineligibleReason == null ? 1 : 0;
    if (ea !== eb) return eb - ea;
    return (b.totalScore ?? -1) - (a.totalScore ?? -1);
  });
}

export function shortFactorLabel(factor: ScoreFactor): string {
  switch (factor) {
    case "price":
      return "Price";
    case "leadTime":
      return "Lead time";
    case "paymentTerms":
      return "Payment terms";
    case "reliability":
      return "Reliability";
    case "flexibility":
      return "Contract flexibility";
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function usd(v: number, digits: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}
