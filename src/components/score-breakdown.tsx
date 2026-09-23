"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupplierScore } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export function ScoreBreakdownSection({ scores }: { scores: SupplierScore[] }) {
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weighted scores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((score, rank) => (
          <SupplierScoreRow key={score.supplierId} score={score} rank={rank} />
        ))}
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">Add suppliers to see weighted scores.</p>}
      </CardContent>
    </Card>
  );
}

function SupplierScoreRow({ score, rank }: { score: SupplierScore; rank: number }) {
  const [open, setOpen] = useState(rank === 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-2xs font-semibold",
              rank === 0 ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            )}
          >
            {rank + 1}
          </span>
          <span className="text-sm font-medium">{score.supplierName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">{score.totalScore.toFixed(1)}</span>
          <span className="text-2xs text-muted-foreground">/ 100</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 py-3">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">How this score was calculated</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1.5 font-medium">Factor</th>
              <th className="pb-1.5 font-medium">Raw value</th>
              <th className="pb-1.5 font-medium">Normalized</th>
              <th className="pb-1.5 font-medium">Weight</th>
              <th className="pb-1.5 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {score.factors.map((f) => (
              <tr key={f.factor} className="border-t border-border/60">
                <td className="py-1.5 pr-2 font-medium">{f.label}</td>
                <td className="py-1.5 pr-2 text-muted-foreground">{f.rawValueLabel}</td>
                <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{f.normalizedScore.toFixed(0)}/100</td>
                <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{f.weight}%</td>
                <td className="py-1.5 text-right tabular-nums font-medium">{f.contribution.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="py-1.5" colSpan={4}>
                Total
              </td>
              <td className="py-1.5 text-right tabular-nums">{score.totalScore.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
        {score.factors.some((f) => f.assumptionNote) && (
          <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
            {score.factors
              .filter((f) => f.assumptionNote)
              .map((f) => (
                <p key={f.factor} className="text-[10px] leading-relaxed text-muted-foreground">
                  <span className="font-medium">{f.label}:</span> {f.assumptionNote}
                </p>
              ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
