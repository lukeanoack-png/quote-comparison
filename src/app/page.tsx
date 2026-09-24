"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AssumptionsPanel } from "@/components/assumptions-panel";
import { ComparisonTable } from "@/components/comparison-table";
import { DecisionAnalysis } from "@/components/decision-analysis";
import { DecisionSummary } from "@/components/decision-summary";
import { NegotiationSection } from "@/components/negotiation-section";
import { QuoteFormDialog } from "@/components/quote-form-dialog";
import { RiskFlagsSection } from "@/components/risk-flags-section";
import { SupplierCards } from "@/components/supplier-cards";
import { UploadQuoteDialog } from "@/components/upload-quote-dialog";
import { buildAllRiskFlags, buildComparison, buildDecision, buildNegotiationInsights, rankScores } from "@/lib/calculations";
import { useAppState } from "@/lib/store/app-context";
import type { SupplierQuote } from "@/lib/types";
import { useRecommendationChange } from "@/lib/use-recommendation-change";

export default function Home() {
  const { state, addQuote, updateQuote } = useAppState();
  const { quotes, assumptions, weights } = state;

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierQuote | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const comparison = useMemo(() => buildComparison(quotes, assumptions, weights), [quotes, assumptions, weights]);
  const decision = useMemo(() => buildDecision(comparison, assumptions, weights), [comparison, assumptions, weights]);
  const negotiation = useMemo(() => buildNegotiationInsights(comparison.suppliers, assumptions), [comparison, assumptions]);
  const riskFlags = useMemo(() => buildAllRiskFlags(comparison.suppliers, assumptions, weights), [comparison, assumptions, weights]);
  const [change, dismissChange] = useRecommendationChange(state.hydrated, assumptions, weights, quotes, comparison);

  // Recommended supplier first, then by score — used to order negotiation and risk items.
  const supplierOrder = useMemo(() => rankScores(comparison.scores).map((s) => s.supplierId), [comparison]);

  function openNew() {
    setEditing(null);
    setQuoteDialogOpen(true);
  }

  function openEdit(q: SupplierQuote) {
    setEditing(q);
    setQuoteDialogOpen(true);
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader onAddQuote={openNew} onUploadQuote={() => setUploadOpen(true)} />

      <main className="mx-auto max-w-[1280px] space-y-12 px-4 py-8 sm:px-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <DecisionSummary decision={decision} assumptions={assumptions} change={change} onDismissChange={dismissChange} />
          <AssumptionsPanel />
        </div>

        <SupplierCards comparison={comparison} onAdd={openNew} onEdit={openEdit} />

        {quotes.length > 0 && (
          <>
            <ComparisonTable comparison={comparison} requiredQuantity={assumptions.requiredQuantity} />
            <DecisionAnalysis comparison={comparison} decision={decision} />
            <NegotiationSection insights={negotiation} supplierOrder={supplierOrder} recommendedId={comparison.bestScoreSupplierId} />
            <RiskFlagsSection flags={riskFlags} supplierOrder={supplierOrder} recommendedId={comparison.bestScoreSupplierId} />
          </>
        )}
      </main>

      <QuoteFormDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        initialQuote={editing}
        onSave={(q) => (editing ? updateQuote(q.id, q) : addQuote(q))}
      />
      <UploadQuoteDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
