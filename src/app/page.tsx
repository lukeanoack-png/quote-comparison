"use client";

import { useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { AssumptionsPanel } from "@/components/assumptions-panel";
import { ComparisonTable } from "@/components/comparison-table";
import { DealAnalysisSection } from "@/components/deal-analysis-section";
import { NegotiationSection } from "@/components/negotiation-section";
import { RiskFlagsSection } from "@/components/risk-flags-section";
import { ScoreBreakdownSection } from "@/components/score-breakdown";
import { SupplierStrip } from "@/components/supplier-strip";
import { WeightsPanel } from "@/components/weights-panel";
import { buildAllRiskFlags, buildComparison, buildDealAnalysis, buildNegotiationInsights } from "@/lib/calculations";
import { useAppState } from "@/lib/store/app-context";

export default function Home() {
  const { state } = useAppState();

  const comparison = useMemo(
    () => buildComparison(state.quotes, state.assumptions, state.weights),
    [state.quotes, state.assumptions, state.weights]
  );

  const dealAnalysis = useMemo(() => buildDealAnalysis(comparison), [comparison]);

  const negotiationInsights = useMemo(
    () => buildNegotiationInsights(comparison.suppliers.map((s) => ({ quote: s.quote, landedCost: s.landedCost }))),
    [comparison]
  );

  const riskFlags = useMemo(
    () => buildAllRiskFlags(comparison.suppliers.map((s) => ({ quote: s.quote, landedCost: s.landedCost }))),
    [comparison]
  );

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader />
      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        <SupplierStrip />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            <ComparisonTable comparison={comparison} />
            <DealAnalysisSection analysis={dealAnalysis} />
            <ScoreBreakdownSection scores={comparison.scores} />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <NegotiationSection insights={negotiationInsights} />
              <RiskFlagsSection flags={riskFlags} />
            </div>
          </div>
          <div className="space-y-6">
            <AssumptionsPanel />
            <WeightsPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
