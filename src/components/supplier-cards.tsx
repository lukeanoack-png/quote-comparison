"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPaymentTermsQuantifiable, type ComparisonResult, type SupplierComparison } from "@/lib/calculations";
import { useAppState } from "@/lib/store/app-context";
import type { SupplierQuote } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary" | "outline";

/** Factual badges, each derived from quote data and only shown when ≥2 suppliers can be compared. */
function buildBadges(s: SupplierComparison, comparison: ComparisonResult): { label: string; variant: BadgeVariant }[] {
  const badges: { label: string; variant: BadgeVariant }[] = [];
  const all = comparison.suppliers;
  const id = s.quote.id;

  if (comparison.bestScoreSupplierId === id) badges.push({ label: "Highest weighted score", variant: "default" });

  const priced = all.filter((x) => x.landedCost.effectiveUnitCost != null);
  if (priced.length >= 2 && comparison.bestCostSupplierId === id) {
    badges.push(
      s.landedCost.costComplete
        ? { label: "Lowest landed cost", variant: "success" }
        : { label: "Lowest known cost", variant: "warning" }
    );
  }

  const leads = all.map((x) => x.quote.leadTimeDays).filter((v): v is number => v != null);
  if (leads.length >= 2 && s.quote.leadTimeDays === Math.min(...leads) && Math.min(...leads) < Math.max(...leads)) {
    badges.push({ label: "Fastest delivery", variant: "secondary" });
  }

  const pay = priced.filter((x) => isPaymentTermsQuantifiable(x.quote.paymentTerms)).map((x) => x.landedCost.paymentTermsValue);
  if (
    pay.length >= 2 &&
    s.landedCost.effectiveUnitCost != null &&
    isPaymentTermsQuantifiable(s.quote.paymentTerms) &&
    s.landedCost.paymentTermsValue === Math.max(...pay) &&
    Math.max(...pay) > Math.min(...pay)
  ) {
    badges.push({ label: "Best payment terms", variant: "secondary" });
  }

  if (!s.landedCost.costComplete) {
    badges.push({ label: s.landedCost.effectiveUnitCost == null ? "No unit price" : "Incomplete cost data", variant: "warning" });
  }

  if (s.quote.quoteExpirationDate) {
    const days = Math.ceil((new Date(s.quote.quoteExpirationDate).getTime() - Date.now()) / 86_400_000);
    if (days < 0) badges.push({ label: "Quote expired", variant: "destructive" });
    else if (days <= 7) badges.push({ label: `Expires in ${days} day${days === 1 ? "" : "s"}`, variant: "destructive" });
  }

  return badges;
}

export function SupplierCards({
  comparison,
  onAdd,
  onEdit,
}: {
  comparison: ComparisonResult;
  onAdd: () => void;
  onEdit: (quote: SupplierQuote) => void;
}) {
  const { removeQuote } = useAppState();
  const scoreById = new Map(comparison.scores.map((s) => [s.supplierId, s]));

  return (
    <section>
      <SectionHeading
        title="Supplier quotes"
        description={`${comparison.suppliers.length} ${comparison.suppliers.length === 1 ? "quote" : "quotes"} · costs shown at your required quantity`}
      />

      {comparison.suppliers.length === 0 ? (
        <button
          onClick={onAdd}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-card py-12 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Add your first supplier quote</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comparison.suppliers.map((s) => {
            const q = s.quote;
            const score = scoreById.get(q.id);
            const isRecommended = comparison.bestScoreSupplierId === q.id;
            const badges = buildBadges(s, comparison);
            const priced = s.landedCost.effectiveUnitCost != null;

            return (
              <article
                key={q.id}
                className={cn(
                  "flex flex-col rounded-lg border bg-card shadow-subtle",
                  isRecommended ? "border-primary/50 ring-1 ring-primary/20" : "border-border/80"
                )}
              >
                <div className="px-5 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold" title={q.supplierName}>
                        {q.supplierName || "Untitled supplier"}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground" title={q.productService}>
                        {[q.productService, q.supplierLocation].filter(Boolean).join(" · ") || "No product specified"}
                      </p>
                    </div>
                    {q.isIncumbent && (
                      <Badge variant="outline" className="shrink-0">
                        <Star className="h-2.5 w-2.5" /> Incumbent
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex min-h-[20px] flex-wrap gap-1.5">
                    {badges.map((b) => (
                      <Badge key={b.label} variant={b.variant}>
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 px-5">
                  <Metric
                    label="Landed cost"
                    value={priced ? formatCurrency(s.landedCost.totalLandedCost, { maximumFractionDigits: 0 }) : null}
                    note={priced && !s.landedCost.costComplete ? `Minimum — excludes ${s.landedCost.missingFields.join(", ").toLowerCase()}` : null}
                  />
                  <Metric label="Effective unit cost" value={priced ? formatCurrency(s.landedCost.effectiveUnitCost) : null} />
                  <Metric label="Lead time" value={q.leadTimeDays != null ? `${q.leadTimeDays} days` : null} />
                  <Metric
                    label="Weighted score"
                    value={score?.totalScore != null ? score.totalScore.toFixed(1) : null}
                    suffix={score?.totalScore != null ? "/ 100" : undefined}
                    note={
                      score?.ineligibleReason
                        ? score.ineligibleReason
                        : score && score.coverage < 1
                          ? `${Math.round(score.coverage * 100)}% of weight scored`
                          : null
                    }
                  />
                </dl>

                <div className="mt-auto flex items-center justify-end gap-1 px-3 pb-3 pt-4">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(q)}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeQuote(q.id)}
                    aria-label={`Remove ${q.supplierName || "supplier"}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, suffix, note }: { label: string; value: string | null; suffix?: string; note?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">
        {value != null ? (
          <span className="text-base font-semibold tabular-nums">
            {value}
            {suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
          </span>
        ) : (
          <span className="text-sm font-medium text-warning">Unknown</span>
        )}
        {note && <p className="mt-0.5 text-2xs leading-snug text-warning">{note}</p>}
      </dd>
    </div>
  );
}
