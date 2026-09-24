"use client";

import { useEffect, useRef, useState } from "react";
import type { ComparisonResult } from "@/lib/calculations";
import { WEIGHT_KEYS, type ScenarioAssumptions, type ScoringWeights, type SupplierQuote } from "@/lib/types";

export interface RecommendationChange {
  fromName: string | null;
  toName: string | null;
  /** The inputs the user changed, e.g. "Required quantity: 1,000 → 5,000 units". */
  causes: string[];
  /** The factor that moved the ranking most, when both suppliers are still present. */
  driver: string | null;
}

interface Snapshot {
  recId: string | null;
  assumptions: ScenarioAssumptions;
  weights: ScoringWeights;
  quotes: SupplierQuote[];
  comparison: ComparisonResult;
}

const WEIGHT_LABELS: Record<keyof ScoringWeights, string> = {
  price: "Price",
  leadTime: "Lead time",
  paymentTerms: "Payment terms",
  reliability: "Reliability",
  flexibility: "Contract flexibility",
};

/**
 * Watches the recommended supplier. When it changes, explains which inputs
 * changed and which scoring factor shifted most between the old and new leader.
 */
export function useRecommendationChange(
  hydrated: boolean,
  assumptions: ScenarioAssumptions,
  weights: ScoringWeights,
  quotes: SupplierQuote[],
  comparison: ComparisonResult
): [RecommendationChange | null, () => void] {
  const prev = useRef<Snapshot | null>(null);
  const [change, setChange] = useState<RecommendationChange | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const current: Snapshot = { recId: comparison.bestScoreSupplierId, assumptions, weights, quotes, comparison };
    if (!prev.current) {
      prev.current = current;
      return;
    }
    // Compare settled states only, so typing "5000" doesn't report every
    // intermediate value (5, 50, 500) as its own change.
    const timer = window.setTimeout(() => {
      const p = prev.current;
      prev.current = current;
      if (p && p.recId !== current.recId) setChange(explain(p, current));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hydrated, assumptions, weights, quotes, comparison]);

  return [change, () => setChange(null)];
}

function supplierName(quotes: SupplierQuote[], id: string | null): string | null {
  if (!id) return null;
  return quotes.find((q) => q.id === id)?.supplierName || "Untitled supplier";
}

function explain(before: Snapshot, after: Snapshot): RecommendationChange {
  const causes: string[] = [];
  const a0 = before.assumptions;
  const a1 = after.assumptions;
  const n = (v: number | null) => (v == null ? "none" : v.toLocaleString());
  if (a0.requiredQuantity !== a1.requiredQuantity) causes.push(`Required quantity: ${n(a0.requiredQuantity)} → ${n(a1.requiredQuantity)} units`);
  if (a0.annualCostOfCapitalPercent !== a1.annualCostOfCapitalPercent)
    causes.push(`Cost of capital: ${a0.annualCostOfCapitalPercent}% → ${a1.annualCostOfCapitalPercent}%`);
  for (const k of WEIGHT_KEYS) {
    if (before.weights[k] !== after.weights[k]) causes.push(`${WEIGHT_LABELS[k]} weight: ${before.weights[k]}% → ${after.weights[k]}%`);
  }
  const beforeIds = new Set(before.quotes.map((q) => q.id));
  const afterIds = new Set(after.quotes.map((q) => q.id));
  for (const q of after.quotes) {
    if (!beforeIds.has(q.id)) causes.push(`Added ${q.supplierName || "a supplier"}`);
    else if (JSON.stringify(q) !== JSON.stringify(before.quotes.find((x) => x.id === q.id))) causes.push(`Edited ${q.supplierName || "a supplier"}'s quote`);
  }
  for (const q of before.quotes) if (!afterIds.has(q.id)) causes.push(`Removed ${q.supplierName || "a supplier"}`);

  const fromId = before.recId;
  const toId = after.recId;
  let driver: string | null = null;

  if (fromId && toId && afterIds.has(fromId)) {
    // Volume discounts crossing a tier are the most concrete explanation, so check them first.
    const discount = (s: Snapshot, id: string) => s.comparison.suppliers.find((x) => x.quote.id === id)?.landedCost.discountApplied?.percent ?? 0;
    for (const id of [toId, fromId]) {
      const d0 = discount(before, id);
      const d1 = discount(after, id);
      if (d0 !== d1) {
        const name = supplierName(after.quotes, id);
        driver =
          d1 > d0
            ? `${name}'s ${d1}% volume discount now applies at ${a1.requiredQuantity.toLocaleString()} units.`
            : `${name}'s ${d0}% volume discount no longer applies at ${a1.requiredQuantity.toLocaleString()} units.`;
        break;
      }
    }

    if (!driver) {
      // Largest change in the new leader's per-factor advantage over the old leader.
      const contrib = (s: Snapshot, id: string, f: string) =>
        s.comparison.scores.find((x) => x.supplierId === id)?.factors.find((x) => x.factor === f)?.contribution ?? 0;
      let best: { label: string; delta: number } | null = null;
      for (const f of after.comparison.scores[0]?.factors ?? []) {
        const gapBefore = contrib(before, toId, f.factor) - contrib(before, fromId, f.factor);
        const gapAfter = contrib(after, toId, f.factor) - contrib(after, fromId, f.factor);
        const delta = gapAfter - gapBefore;
        if (!best || delta > best.delta) best = { label: f.label, delta };
      }
      if (best && best.delta > 0.05) {
        driver = `Biggest shift: ${best.label.toLowerCase()} — ${supplierName(after.quotes, toId)} gained ${best.delta.toFixed(1)} points relative to ${supplierName(after.quotes, fromId)}.`;
      }
    }
  }

  return {
    fromName: supplierName(before.quotes, fromId),
    toName: supplierName(after.quotes, toId),
    causes: causes.length > 0 ? causes : ["Data was reloaded"],
    driver,
  };
}
