"use client";

import { Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NegotiationInsight } from "@/lib/calculations";

const CATEGORY_LABEL: Record<NegotiationInsight["category"], string> = {
  freight: "Freight",
  "payment-terms": "Payment terms",
  "volume-discount": "Volume discount",
  "setup-fee": "Setup fee",
  "lead-time": "Lead time",
  warranty: "Warranty",
  moq: "MOQ",
};

export function NegotiationSection({ insights }: { insights: NegotiationInsight[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5" />
          Negotiation opportunities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.length === 0 && (
          <p className="text-sm text-muted-foreground">No clear negotiation gaps identified yet — add more supplier quotes to compare terms.</p>
        )}
        {insights.map((insight) => (
          <div key={insight.id} className="rounded-md border border-border p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="outline">{CATEGORY_LABEL[insight.category]}</Badge>
              <span className="text-xs font-medium text-muted-foreground">{insight.supplierName || "Untitled supplier"}</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{insight.observation}</p>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-accent">{insight.suggestion}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
