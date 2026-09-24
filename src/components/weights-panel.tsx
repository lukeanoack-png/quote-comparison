"use client";

import { Slider } from "@/components/ui/slider";
import { InfoTooltip } from "@/components/ui/tooltip";
import { useAppState } from "@/lib/store/app-context";
import { DEFAULT_WEIGHTS, WEIGHT_KEYS, type ScoringWeights } from "@/lib/types";
import { cn } from "@/lib/utils";

const FACTOR_META: Record<keyof ScoringWeights, { label: string; tooltip: string }> = {
  price: { label: "Price", tooltip: "Effective unit cost: landed cost after volume discounts and payment-term value, per unit." },
  leadTime: { label: "Lead time", tooltip: "Days until delivery, as quoted." },
  paymentTerms: { label: "Payment terms", tooltip: "Dollar value of paying later, at your cost of capital." },
  reliability: { label: "Reliability", tooltip: "Your own 1–5 rating for each supplier." },
  flexibility: { label: "Contract flexibility", tooltip: "Shorter or no contract commitment scores higher. Unknown contract length is not scored." },
};

/** Priority-weight sliders (rendered inside the assumptions panel). */
export function WeightControls() {
  const { state, setWeights } = useAppState();
  const weights = state.weights;
  const total = WEIGHT_KEYS.reduce((sum, k) => sum + weights[k], 0);
  const isBalanced = total === 100;
  const isDefault = WEIGHT_KEYS.every((k) => weights[k] === DEFAULT_WEIGHTS[k]);

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
    <div className="space-y-4">
      {WEIGHT_KEYS.map((key) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium">
              {FACTOR_META[key].label}
              <InfoTooltip text={FACTOR_META[key].tooltip} />
            </label>
            <span className="text-xs font-medium tabular-nums">{weights[key]}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[weights[key]]}
            onValueChange={([v]) => setWeights({ ...weights, [key]: v })}
            aria-label={`${FACTOR_META[key].label} weight`}
          />
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
        <span className={cn("font-medium tabular-nums", isBalanced ? "text-muted-foreground" : "text-warning")}>
          {isBalanced ? "Total 100%" : `Total ${total}% — scores are still comparable`}
        </span>
        {!isBalanced ? (
          <button type="button" onClick={autoBalance} className="font-medium text-primary hover:underline">
            Balance to 100%
          </button>
        ) : (
          !isDefault && (
            <button type="button" onClick={() => setWeights(DEFAULT_WEIGHTS)} className="font-medium text-primary hover:underline">
              Reset to defaults
            </button>
          )
        )}
      </div>
    </div>
  );
}
