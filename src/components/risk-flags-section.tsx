"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskFlag } from "@/lib/calculations";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<RiskFlag["severity"], string> = {
  high: "border-destructive/30 bg-destructive/5 text-destructive",
  medium: "border-warning/30 bg-warning/5 text-warning",
  low: "border-border bg-muted/40 text-muted-foreground",
};

export function RiskFlagsSection({ flags }: { flags: RiskFlag[] }) {
  const sorted = [...flags].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Missing information & risk flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No risk flags — all quotes are fully specified.</p>}
        {sorted.map((flag) => (
          <div key={flag.id} className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed", SEVERITY_STYLES[flag.severity])}>
            <span className="mt-0.5 shrink-0 font-semibold uppercase tracking-wide text-[9px]">{flag.severity}</span>
            <span>{flag.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function severityRank(s: RiskFlag["severity"]): number {
  return s === "high" ? 0 : s === "medium" ? 1 : 2;
}
