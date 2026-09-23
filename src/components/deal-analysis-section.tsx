"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DealAnalysis } from "@/lib/calculations";

export function DealAnalysisSection({ analysis }: { analysis: DealAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" />
          Deal analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {analysis.observations.map((obs, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              {obs}
            </li>
          ))}
        </ul>

        {analysis.recommendation && (
          <div className="rounded-md border border-accent/30 bg-accent/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge>Recommendation</Badge>
            </div>
            <p className="text-sm font-medium leading-relaxed">{analysis.recommendation}</p>
            {analysis.reasons.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-accent/20 pt-3">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Why, by factor</p>
                {analysis.reasons.map((r, i) => (
                  <p key={i} className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">{r.label}:</span> {r.detail}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
