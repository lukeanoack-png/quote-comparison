"use client";

import { SlidersHorizontal } from "lucide-react";
import { NumberField } from "@/components/number-field";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeightControls } from "@/components/weights-panel";
import { useAppState } from "@/lib/store/app-context";
import { DEFAULT_ASSUMPTIONS } from "@/lib/types";

/** "Adjust assumptions" panel shown beside the recommendation. */
export function AssumptionsPanel() {
  const { state, setAssumptions } = useAppState();
  const a = state.assumptions;
  const isDefault = JSON.stringify(a) === JSON.stringify(DEFAULT_ASSUMPTIONS);

  return (
    <Card className="flex flex-col">
      <div className="px-5 pb-1 pt-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          Adjust assumptions
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Every figure and the recommendation update instantly.</p>
      </div>
      <Tabs defaultValue="scenario" className="px-5 pb-5 pt-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scenario">Scenario</TabsTrigger>
          <TabsTrigger value="priorities">Priorities</TabsTrigger>
        </TabsList>
        <TabsContent value="scenario" className="space-y-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <NumberField
              label="Required quantity"
              value={a.requiredQuantity}
              onChange={(v) => setAssumptions({ ...a, requiredQuantity: v ?? 0 })}
              suffix="units"
              tooltip="The quantity you actually need. Landed cost, volume discounts, and MOQ checks are all recalculated at this quantity."
            />
            <NumberField
              label="Cost of capital"
              value={a.annualCostOfCapitalPercent}
              onChange={(v) => setAssumptions({ ...a, annualCostOfCapitalPercent: v ?? 0 })}
              suffix="%/yr"
              tooltip="Your borrowing rate or return on cash. Used to value payment terms: paying later is worth this rate, prorated over the delay."
            />
            <NumberField
              label="Orders per year"
              value={a.ordersPerYear}
              onChange={(v) => setAssumptions({ ...a, ordersPerYear: v ?? 0 })}
              suffix="/yr"
              tooltip="How often this purchase repeats. Used to annualize the cost difference in the decision summary, assuming each order repeats on these terms."
            />
            <NumberField
              label="Max lead time"
              value={a.maxAcceptableLeadTimeDays}
              onChange={(v) => setAssumptions({ ...a, maxAcceptableLeadTimeDays: v })}
              suffix="days"
              tooltip="Suppliers slower than this are flagged as a material risk. Leave blank for no limit. Does not change scores."
            />
          </div>
          {!isDefault && (
            <button
              type="button"
              onClick={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Reset scenario to defaults
            </button>
          )}
        </TabsContent>
        <TabsContent value="priorities">
          <WeightControls />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
