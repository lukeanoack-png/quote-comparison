"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/tooltip";
import { NumberField } from "@/components/number-field";
import { useAppState } from "@/lib/store/app-context";

export function AssumptionsPanel() {
  const { state, setAssumptions } = useAppState();
  const a = state.assumptions;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Scenario assumptions
          <InfoTooltip text="These drive every calculation below. Change them to see costs, rankings, and the recommendation update instantly." />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <NumberField
          label="Required order quantity"
          value={a.requiredQuantity}
          onChange={(v) => setAssumptions({ ...a, requiredQuantity: v ?? 0 })}
          suffix="units"
          tooltip="The quantity you actually need. All landed-cost and per-unit figures are recalculated at this quantity, including volume discounts and MOQ checks."
        />
        <NumberField
          label="Annual cost of capital"
          value={a.annualCostOfCapitalPercent}
          onChange={(v) => setAssumptions({ ...a, annualCostOfCapitalPercent: v ?? 0 })}
          suffix="%/yr"
          tooltip="Your business's cost of capital (borrowing rate or opportunity cost of cash). Used to value delayed payment terms: cash you keep longer is worth this rate, annualized over the delay."
        />
        <NumberField
          label="Orders per year"
          value={a.ordersPerYear}
          onChange={(v) => setAssumptions({ ...a, ordersPerYear: v ?? 0 })}
          suffix="/yr"
          tooltip="How often this purchase repeats. Used to annualize recurring fees for comparison."
        />
        <NumberField
          label="Max acceptable lead time"
          value={a.maxAcceptableLeadTimeDays}
          onChange={(v) => setAssumptions({ ...a, maxAcceptableLeadTimeDays: v })}
          suffix="days"
          tooltip="Suppliers slower than this are flagged as a risk. Leave blank for no cap."
        />
      </CardContent>
    </Card>
  );
}
