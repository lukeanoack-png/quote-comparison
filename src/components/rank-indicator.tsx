import { cn } from "@/lib/utils";

export type RankStatus = "best" | "second" | "unfavorable" | "neutral" | "missing";

export function rankValues(values: (number | null)[], lowerIsBetter: boolean): RankStatus[] {
  const known = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  const sorted = [...known].sort((a, b) => (lowerIsBetter ? a.v - b.v : b.v - a.v));

  const statuses: RankStatus[] = values.map((v) => (v == null ? "missing" : "neutral"));
  if (sorted.length > 0) statuses[sorted[0].i] = "best";
  if (sorted.length > 1) statuses[sorted[1].i] = "second";
  if (sorted.length >= 3) statuses[sorted[sorted.length - 1].i] = "unfavorable";
  return statuses;
}

const DOT_CLASSES: Record<RankStatus, string> = {
  best: "bg-success",
  second: "bg-accent",
  unfavorable: "bg-warning",
  neutral: "bg-border",
  missing: "bg-transparent border border-dashed border-muted-foreground/50",
};

export function RankDot({ status }: { status: RankStatus }) {
  return <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[status])} aria-hidden />;
}

export function rankLabel(status: RankStatus): string | null {
  switch (status) {
    case "best":
      return "Best";
    case "second":
      return "2nd best";
    case "unfavorable":
      return "Unfavorable";
    case "missing":
      return "Missing";
    default:
      return null;
  }
}
