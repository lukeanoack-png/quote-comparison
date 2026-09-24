"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MIN_COVERAGE_FOR_RECOMMENDATION, rankScores, type ComparisonResult, type Decision, type FactorScore, type SupplierScore } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export function DecisionAnalysis({ comparison, decision }: { comparison: ComparisonResult; decision: Decision }) {
  const [open, setOpen] = useState(false);
  const ranked = rankScores(comparison.scores);
  if (ranked.length === 0) return null;

  return (
    <section>
      <SectionHeading title="Decision analysis" description="How each supplier scores at your current priorities, and what drives the ranking." />
      <Card>
        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weighted score</h3>
            <ol className="mt-3 space-y-4">
              {ranked.map((s, i) => (
                <ScoreBar key={s.supplierId} score={s} rank={i + 1} isTop={s.supplierId === comparison.bestScoreSupplierId} />
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost and tradeoffs</h3>
            <ul className="mt-3 space-y-2.5">
              {decision.observations.map((o, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-snug">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3.5 text-left text-sm font-medium text-primary hover:bg-muted/40">
            How this score was calculated
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Methodology comparison={comparison} ranked={ranked} />
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </section>
  );
}

function ScoreBar({ score, rank, isTop }: { score: SupplierScore; rank: number; isTop: boolean }) {
  const eligible = score.ineligibleReason == null;
  const value = score.totalScore ?? 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{eligible ? rank : "–"}</span>
          <span className="truncate text-sm font-medium">{score.supplierName}</span>
          {isTop && <Badge>Recommended</Badge>}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {score.totalScore != null ? score.totalScore.toFixed(1) : "—"}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">/100</span>
        </span>
      </div>
      <div className="ml-6 mt-1.5 h-1.5 overflow-hidden rounded-sm bg-muted">
        <div
          className={cn("h-full rounded-sm", !eligible ? "bg-muted-foreground/25" : isTop ? "bg-primary" : "bg-foreground/35")}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <p className={cn("ml-6 mt-1 text-xs", eligible && score.coverage === 1 ? "text-muted-foreground" : "text-warning")}>
        {score.ineligibleReason ??
          (score.coverage === 1
            ? "All weighted factors scored"
            : `Scored on ${Math.round(score.coverage * 100)}% of weight · ${score.unscoredFactors.join(", ").toLowerCase()} unknown`)}
      </p>
    </li>
  );
}

function Methodology({ comparison, ranked }: { comparison: ComparisonResult; ranked: SupplierScore[] }) {
  const example = findPriceExample(ranked);

  return (
    <div className="space-y-8 border-t border-border bg-muted/30 px-6 py-6 text-sm">
      <div className="grid gap-6 md:grid-cols-3">
        <Step n={1} title="Normalize each factor to 0–100">
          For price, lead time, and payment terms, the best value among suppliers that provided one scores 100 and the worst scores 0; values in between
          fall on a straight line. Reliability and contract flexibility use fixed scales so one supplier&apos;s value means the same thing on its own.
        </Step>
        <Step n={2} title="Weight and add">
          Each factor score is multiplied by its priority weight. The weighted score is{" "}
          <span className="whitespace-nowrap font-mono text-xs">Σ(score × weight) ÷ Σ(weights scored)</span>, which always lands on 0–100.
        </Step>
        <Step n={3} title="Missing data is not scored">
          An unknown value is never treated as good or bad. It&apos;s marked <em>Unknown</em>, and its weight is redistributed proportionally to that
          supplier&apos;s known factors. Suppliers need a unit price and at least {MIN_COVERAGE_FOR_RECOMMENDATION * 100}% of weight scored to be recommended.
        </Step>
      </div>

      {example && (
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Worked example</p>
          <p className="mt-1.5 leading-relaxed">
            {example.name}&apos;s effective unit cost is <strong>{example.factor.rawValueLabel}</strong>. Across the compared suppliers the lowest is{" "}
            {example.best} (scores 100) and the highest is {example.worst} (scores 0), so:
          </p>
          <p className="mt-1.5 font-mono text-xs">{example.factor.calculation}</p>
          <p className="mt-1.5 text-muted-foreground">
            With price weighted {example.factor.weight}%{" "}
            {example.factor.effectiveWeight.toFixed(1) !== example.factor.weight.toFixed(1) &&
              `(${example.factor.effectiveWeight.toFixed(1)}% after redistributing unknown factors) `}
            that contributes {example.factor.normalizedScore?.toFixed(0)} × {example.factor.effectiveWeight.toFixed(1)}% ={" "}
            <strong className="text-foreground">{example.factor.contribution.toFixed(1)} points</strong>.
          </p>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Normalization rules</h4>
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Factor</th>
                <th className="px-3 py-2 font-medium">Weight</th>
                <th className="px-3 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Scale in this comparison</th>
              </tr>
            </thead>
            <tbody>
              {comparison.scoringMethods.map((m) => (
                <tr key={m.factor} className="border-b border-border/60 last:border-0 align-top">
                  <td className="px-3 py-2 font-medium">{m.label}</td>
                  <td className="px-3 py-2 tabular-nums">{m.weight}%</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.rule}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {m.scale}
                    {m.note && <p className="mt-0.5 text-warning">{m.note}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score breakdown</h4>
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[720px] table-fixed text-xs">
            <colgroup>
              <col className="w-36" />
              {ranked.map((s) => (
                <col key={s.supplierId} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Factor</th>
                {ranked.map((s) => (
                  <th key={s.supplierId} className="truncate px-3 py-2 font-semibold">
                    {s.supplierName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked[0].factors.map((f, fi) => (
                <tr key={f.factor} className="border-b border-border/60 align-top">
                  <td className="px-3 py-2.5 font-medium">
                    {f.label}
                    <p className="font-normal text-muted-foreground">{f.weight}% weight</p>
                  </td>
                  {ranked.map((s) => (
                    <FactorCell key={s.supplierId} f={s.factors[fi]} />
                  ))}
                </tr>
              ))}
              <tr className="bg-muted/40">
                <td className="px-3 py-2.5 font-semibold">Weighted score</td>
                {ranked.map((s) => (
                  <td key={s.supplierId} className="px-3 py-2.5">
                    <span className="text-sm font-semibold tabular-nums">{s.totalScore != null ? s.totalScore.toFixed(1) : "—"}</span>
                    <p className={cn("mt-0.5", s.coverage < 1 ? "text-warning" : "text-muted-foreground")}>
                      {Math.round(s.coverage * 100)}% of weight scored
                    </p>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FactorCell({ f }: { f: FactorScore }) {
  if (f.status !== "scored") {
    return (
      <td className="px-3 py-2.5">
        <p className="font-medium text-warning">{f.status === "unknown" ? "Unknown — not scored" : "Not comparable — not scored"}</p>
        <p className="mt-0.5 text-muted-foreground">{f.note}</p>
        {f.weight > 0 && <p className="mt-0.5 text-muted-foreground">{f.weight}% weight redistributed</p>}
      </td>
    );
  }
  return (
    <td className="px-3 py-2.5">
      <p className="font-medium">{f.rawValueLabel}</p>
      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{f.calculation}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        {f.normalizedScore?.toFixed(0)} × {f.effectiveWeight.toFixed(1)}% = <span className="font-semibold text-foreground">{f.contribution.toFixed(1)} pts</span>
      </p>
      {f.note && <p className="mt-0.5 text-warning">{f.note}</p>}
    </td>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-2xs text-background">{n}</span>
        {title}
      </p>
      <p className="mt-1.5 leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/** A price score strictly between best and worst makes the clearest worked example. */
function findPriceExample(ranked: SupplierScore[]) {
  const priced = ranked
    .map((s) => ({ name: s.supplierName, factor: s.factors.find((f) => f.factor === "price") as FactorScore }))
    .filter((x) => x.factor.status === "scored" && x.factor.rawValue != null);
  if (priced.length < 2) return null;
  const values = priced.map((p) => p.factor.rawValue as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return null;
  const pick = priced.find((p) => p.factor.rawValue !== min && p.factor.rawValue !== max) ?? priced[0];
  const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { ...pick, best: fmt(min), worst: fmt(max) };
}
