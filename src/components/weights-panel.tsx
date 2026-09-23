"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import { useAppState } from "@/lib/store/app-context";
import { DEFAULT_WEIGHTS, WEIGHT_KEYS, type ScoringWeights } from "@/lib/types";
import { cn } from "@/lib/utils";

const FACTOR_META: Record<keyof ScoringWeights, { label: string; tooltip: string }> = {
  price: { label: "Price", tooltip: "Effective unit cost after volume discounts and payment-term value." },
  leadTime: { label: "Lead time", tooltip: "Days until delivery, as stated on the quote." },
  paymentTerms: { label: "Payment terms", tooltip: "Dollar value of delayed payment vs. paying immediately." },
  reliability: { label: "Reliability", tooltip: "Your subjective 1-5 rating for each supplier." },
  flexibility: { label: "Contract flexibility", tooltip: "Shorter or no contract commitment scores higher." },
};

export function WeightsPanel() {
  const { state, setWeights } = useAppState();
  const weights = state.weights;
  const total = WEIGHT_KEYS.reduce((sum, k) => sum + weights[k], 0);
  const isBalanced = total === 100;

  function updateWeight(key: keyof ScoringWeights, value: number) {
    setWeights({ ...weights, [key]: value });
  }

  function autoBalance() {
    if (total === 0) {
      setWeights(DEFAULT_WEIGHTS);
      return;
    }
    const scaled: ScoringWeights = { ...weights };
    let running = 0;
    WEIGHT_KEYS.forEach((k, idx) => {
      if (idx === WEIGHT_KEYS.length - 1) {
        scaled[k] = 100 - running;
      } else {
        const v = Math.round((weights[k] / total) * 100);
        scaled[k] = v;
        running += v;
      }
    });
    setWeights(scaled);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-1.5">
          Priority weighting
          <InfoTooltip text="Set how much each factor matters to your decision. Weights must total 100%. The weighted score in the comparison table and deal analysis updates immediately." />
        </CardTitle>
        <Badge variant={isBalanced ? "success" : "warning"}>{total}% allocated</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {WEIGHT_KEYS.map((key) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium">
                {FACTOR_META[key].label}
                <InfoTooltip text={FACTOR_META[key].tooltip} />
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">{weights[key]}%</span>
            </div>
            <Slider min={0} max={100} step={5} value={[weights[key]]} onValueChange={([v]) => updateWeight(key, v)} />
          </div>
        ))}
        <div className={cn("flex items-center justify-between rounded-md px-3 py-2 text-xs", isBalanced ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
          <span>{isBalanced ? "Weights total 100%." : `Weights total ${total}%, not 100%.`}</span>
          {!isBalanced && (
            <Button variant="outline" size="sm" onClick={autoBalance}>
              Balance to 100%
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
