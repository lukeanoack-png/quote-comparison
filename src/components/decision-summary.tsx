"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, RefreshCw, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ConfidenceLevel, ConfidenceReason, Decision } from "@/lib/calculations";
import type { ScenarioAssumptions } from "@/lib/types";
import type { RecommendationChange } from "@/lib/use-recommendation-change";
import { cn, formatCurrency } from "@/lib/utils";

const usd0 = (v: number) => formatCurrency(v, { maximumFractionDigits: 0 });

export function DecisionSummary({
  decision,
  assumptions,
  change,
  onDismissChange,
}: {
  decision: Decision;
  assumptions: ScenarioAssumptions;
  change: RecommendationChange | null;
  onDismissChange: () => void;
}) {
  const { recommended, lowestCost, confidence } = decision;

  return (
    <Card className="overflow-hidden">
      {change && <ChangeBanner change={change} onDismiss={onDismissChange} />}

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision summary</p>
          <ConfidenceBadge level={confidence.level} />
        </div>

        {recommended ? (
          <>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Recommended supplier</p>
              <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">{recommended.score.supplierName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Highest weighted score at your current priorities
                {recommended.comparison.quote.productService ? ` · ${recommended.comparison.quote.productService}` : ""}
              </p>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4 lg:divide-x lg:divide-border">
              <Metric label="Weighted score" className="lg:pr-5">
                <span className="text-2xl font-semibold tabular-nums">{recommended.score.totalScore?.toFixed(1)}</span>
                <span className="ml-1 text-sm text-muted-foreground">/ 100</span>
                <MetricNote tone={recommended.score.coverage < 1 ? "warn" : "muted"}>
                  {recommended.score.coverage < 1
                    ? `Scored on ${Math.round(recommended.score.coverage * 100)}% of weight`
                    : "All factors scored"}
                </MetricNote>
              </Metric>

              <Metric label="Lowest landed cost" className="pl-0 lg:px-5">
                {lowestCost ? (
                  <>
                    <span className="text-2xl font-semibold tabular-nums">{usd0(lowestCost.landedCost.totalLandedCost)}</span>
                    <MetricNote tone={lowestCost.landedCost.costComplete ? "muted" : "warn"}>
                      {lowestCost.quote.supplierName}
                      {!lowestCost.landedCost.costComplete && " · some costs unknown"}
                    </MetricNote>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No priced quotes</span>
                )}
              </Metric>

              <Metric label="Premium vs. lowest cost" className="lg:px-5">
                {decision.costDifference == null ? (
                  <span className="text-sm text-muted-foreground">Can&apos;t compare</span>
                ) : decision.costDifference === 0 ? (
                  <>
                    <span className="text-2xl font-semibold text-success">$0</span>
                    <MetricNote tone="muted">Recommendation is the lowest cost</MetricNote>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-semibold tabular-nums">+{usd0(decision.costDifference)}</span>
                    <span className="ml-1.5 text-sm text-muted-foreground">+{decision.costDifferencePercent?.toFixed(1)}%</span>
                    <MetricNote tone="muted">
                      At {assumptions.requiredQuantity.toLocaleString()} units
                      {decision.annualizedCostDifference != null &&
                        ` · ≈ ${usd0(decision.annualizedCostDifference)}/yr at ${assumptions.ordersPerYear} orders`}
                    </MetricNote>
                  </>
                )}
              </Metric>

              <Metric label="Confidence" className="pl-0 lg:pl-5">
                <span className={cn("text-2xl font-semibold capitalize", CONFIDENCE_TEXT[confidence.level])}>{confidence.level}</span>
                <MetricNote tone="muted">{confidenceSummary(confidence.reasons)}</MetricNote>
              </Metric>
            </dl>

            {decision.primaryTradeoff && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary tradeoff</p>
                <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed">{decision.primaryTradeoff}</p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-3">
            <h2 className="text-xl font-semibold tracking-tight">No recommendation yet</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A recommendation needs at least two suppliers with a unit price and enough known terms to score.
            </p>
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What affects confidence</p>
          <ul className="mt-2 space-y-1.5">
            {confidence.reasons.map((r, i) => (
              <ReasonItem key={i} reason={r} />
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

const CONFIDENCE_TEXT: Record<ConfidenceLevel, string> = {
  high: "text-foreground",
  medium: "text-warning",
  low: "text-destructive",
};

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const variant = level === "high" ? "outline" : level === "medium" ? "warning" : "destructive";
  return <Badge variant={variant} className="capitalize">{level} confidence</Badge>;
}

function confidenceSummary(reasons: ConfidenceReason[]): string {
  const risks = reasons.filter((r) => r.tone === "risk").length;
  const warns = reasons.filter((r) => r.tone === "warn").length;
  if (risks > 0) return `${risks} issue${risks === 1 ? "" : "s"} could change the outcome`;
  if (warns > 0) return `${warns} data gap${warns === 1 ? "" : "s"} noted below`;
  return "Complete data, clear lead";
}

function Metric({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 pr-4", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function MetricNote({ tone, children }: { tone: "muted" | "warn"; children: React.ReactNode }) {
  return <p className={cn("mt-1 text-xs", tone === "warn" ? "text-warning" : "text-muted-foreground")}>{children}</p>;
}

function ReasonItem({ reason }: { reason: ConfidenceReason }) {
  const Icon = reason.tone === "ok" ? CheckCircle2 : reason.tone === "warn" ? CircleHelp : AlertTriangle;
  return (
    <li className="flex gap-2 text-sm leading-snug">
      <Icon
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          reason.tone === "ok" ? "text-muted-foreground" : reason.tone === "warn" ? "text-warning" : "text-destructive"
        )}
      />
      <span className={reason.tone === "ok" ? "text-muted-foreground" : "text-foreground"}>{reason.text}</span>
    </li>
  );
}

function ChangeBanner({ change, onDismiss }: { change: RecommendationChange; onDismiss: () => void }) {
  return (
    <div className="flex gap-3 border-b border-primary/20 bg-primary/[0.06] px-6 py-4" role="status" aria-live="polite">
      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          Recommendation changed
          {change.fromName && change.toName && (
            <span className="font-normal">
              {": "}
              {change.fromName} <ArrowRight className="inline h-3.5 w-3.5 align-[-2px]" /> <span className="font-semibold">{change.toName}</span>
            </span>
          )}
          {!change.toName && <span className="font-normal">: no supplier can currently be recommended</span>}
        </p>
        <p className="mt-1 text-muted-foreground">
          Caused by: <span className="text-foreground">{change.causes.join("; ")}</span>
        </p>
        {change.driver && <p className="mt-0.5 text-muted-foreground">{change.driver}</p>}
      </div>
      <button type="button" onClick={onDismiss} className="h-6 w-6 shrink-0 rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss">
        <X className="mx-auto h-3.5 w-3.5" />
      </button>
    </div>
  );
}
