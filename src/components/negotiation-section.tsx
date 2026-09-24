"use client";

import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import type { NegotiationInsight } from "@/lib/calculations";

const CATEGORY_LABEL: Record<NegotiationInsight["category"], string> = {
  freight: "Freight",
  "payment-terms": "Payment terms",
  "volume-discount": "Volume discount",
  "setup-fee": "Setup fee",
  "lead-time": "Lead time",
  warranty: "Warranty",
};

export function NegotiationSection({
  insights,
  supplierOrder,
  recommendedId,
}: {
  insights: NegotiationInsight[];
  /** Supplier ids in display order (recommended first). */
  supplierOrder: string[];
  recommendedId: string | null;
}) {
  const groups = supplierOrder
    .map((id) => ({
      id,
      name: insights.find((i) => i.supplierId === id)?.supplierName ?? "",
      items: insights
        .filter((i) => i.supplierId === id)
        .sort((a, b) => (b.gapValue ?? -1) - (a.gapValue ?? -1)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <section>
      <SectionHeading
        title="Negotiation opportunities"
        description="Where each quote trails the best competing term in this comparison, and what to ask for."
      />
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          No gaps found between quotes. Add another quote to benchmark against.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="mb-2.5 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{g.name}</h3>
                {g.id === recommendedId && <Badge>Recommended</Badge>}
                <span className="text-xs text-muted-foreground">
                  {g.items.length} {g.items.length === 1 ? "ask" : "asks"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.items.map((i) => (
                  <article key={i.id} className="flex flex-col rounded-lg border border-border/80 bg-card p-4 shadow-subtle">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{CATEGORY_LABEL[i.category]}</p>
                    <p className="mt-1 text-sm font-semibold">{i.issue}</p>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
                        <dt className="text-muted-foreground">Benchmark</dt>
                        <dd>{i.benchmark}</dd>
                      </div>
                      <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
                        <dt className="text-muted-foreground">Gap</dt>
                        <dd className="font-semibold tabular-nums">{i.gap}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-primary">Suggested ask</p>
                      <p className="mt-1 text-sm leading-snug">{i.ask}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
