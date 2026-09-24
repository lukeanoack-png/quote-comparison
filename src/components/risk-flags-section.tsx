"use client";

import { AlertTriangle, ArrowRight, CircleHelp, ShieldAlert } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import type { RiskFlag } from "@/lib/calculations";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function RiskFlagsSection({
  flags,
  supplierOrder,
  recommendedId,
}: {
  flags: RiskFlag[];
  supplierOrder: string[];
  recommendedId: string | null;
}) {
  const order = (f: RiskFlag) => supplierOrder.indexOf(f.supplierId);
  const sort = (a: RiskFlag, b: RiskFlag) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || order(a) - order(b);
  const risks = flags.filter((f) => f.kind === "risk").sort(sort);
  const missing = flags.filter((f) => f.kind === "missing").sort(sort);

  return (
    <section>
      <SectionHeading
        title="Missing information & risks"
        description="What could change the decision, and the next step for each."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <FlagList
          title="Material risks"
          icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
          empty="No material risks found in the quoted terms."
          flags={risks}
          recommendedId={recommendedId}
        />
        <FlagList
          title="Missing information"
          icon={<CircleHelp className="h-4 w-4 text-warning" />}
          empty="Every quote states all tracked terms."
          flags={missing}
          recommendedId={recommendedId}
        />
      </div>
    </section>
  );
}

function FlagList({
  title,
  icon,
  empty,
  flags,
  recommendedId,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  flags: RiskFlag[];
  recommendedId: string | null;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{flags.length}</span>
      </div>
      {flags.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {flags.map((f) => (
            <FlagItem key={f.id} flag={f} isRecommended={f.supplierId === recommendedId} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function FlagItem({ flag, isRecommended }: { flag: RiskFlag; isRecommended: boolean }) {
  const isRisk = flag.kind === "risk";
  return (
    <li className="flex gap-3 px-5 py-3.5">
      <span className="mt-0.5 shrink-0">
        {isRisk ? (
          <AlertTriangle className={cn("h-3.5 w-3.5", flag.severity === "high" ? "text-destructive" : "text-muted-foreground")} />
        ) : (
          <span className={cn("mt-1 block h-2 w-2 rounded-full", flag.severity === "low" ? "bg-warning/40" : "bg-warning")} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{flag.supplierName}</span>
          {isRecommended && <span className="text-primary">Recommended</span>}
          {flag.impact && <span>· Affects {flag.impact.toLowerCase()}</span>}
        </p>
        <p className={cn("mt-0.5 text-sm font-medium", isRisk && flag.severity === "high" && "text-destructive")}>{flag.title}</p>
        {flag.detail && <p className="mt-0.5 text-xs text-muted-foreground">{flag.detail}</p>}
        <p className="mt-1.5 flex gap-1.5 text-xs">
          <ArrowRight className="mt-[1px] h-3 w-3 shrink-0 text-primary" />
          <span>{flag.action}</span>
        </p>
      </div>
    </li>
  );
}
