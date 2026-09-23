"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { QuoteFormDialog } from "@/components/quote-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/store/app-context";
import type { SupplierQuote } from "@/lib/types";
import { paymentTermsLabel } from "@/lib/calculations";
import { formatCurrency } from "@/lib/utils";

export function SupplierStrip() {
  const { state, addQuote, updateQuote, removeQuote } = useAppState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierQuote | null>(null);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(q: SupplierQuote) {
    setEditing(q);
    setDialogOpen(true);
  }

  function handleSave(quote: SupplierQuote) {
    if (editing) {
      updateQuote(quote.id, quote);
    } else {
      addQuote(quote);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Supplier quotes</h2>
          <p className="text-xs text-muted-foreground">
            {state.quotes.length} {state.quotes.length === 1 ? "quote" : "quotes"} under comparison
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Add supplier quote
        </Button>
      </div>

      {state.quotes.length === 0 ? (
        <button
          onClick={openNew}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card py-10 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Add your first supplier quote</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.quotes.map((q) => (
            <div key={q.id} className="flex flex-col rounded-lg border border-border bg-card shadow-card">
              <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" title={q.supplierName}>
                    {q.supplierName || "Untitled supplier"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={q.productService}>
                    {q.productService || "No product specified"}
                  </p>
                </div>
                {q.isIncumbent && (
                  <Badge variant="secondary" className="shrink-0">
                    <Star className="h-2.5 w-2.5" /> Incumbent
                  </Badge>
                )}
              </div>
              <dl className="grid grid-cols-3 divide-x divide-border border-y border-border">
                <Metric label="Unit price" value={q.unitPrice != null ? formatCurrency(q.unitPrice) : null} />
                <Metric label="Lead time" value={q.leadTimeDays != null ? `${q.leadTimeDays} days` : null} />
                <Metric label="Terms" value={paymentTermsLabel(q.paymentTerms)} />
              </dl>
              <div className="flex items-center justify-end gap-1 px-3 py-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeQuote(q.id)}
                  aria-label={`Remove ${q.supplierName || "supplier"}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuoteFormDialog open={dialogOpen} onOpenChange={setDialogOpen} initialQuote={editing} onSave={handleSave} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={value ? "truncate text-sm font-semibold tabular-nums" : "text-sm italic text-muted-foreground"}>{value ?? "Unknown"}</dd>
    </div>
  );
}
