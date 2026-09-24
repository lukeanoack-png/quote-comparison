"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/tooltip";
import { isPaymentTermsQuantifiable, paymentTermsLabel, type ComparisonResult, type SupplierComparison } from "@/lib/calculations";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";

/**
 * best     — best value in the row (green only in the Economics group)
 * missing  — not provided (amber)
 * risk     — material risk (red)
 */
type Tone = "best" | "neutral" | "missing" | "risk";

interface Cell {
  display: string;
  sub?: string;
  tone: Tone;
}

interface Row {
  key: string;
  label: string;
  tooltip?: string;
  cells: Cell[];
}

interface Group {
  key: string;
  label: string;
  /** Whether "best" is favorable economics (green) or just the strongest term (bold). */
  economic: boolean;
  primary: Row[];
  secondary: Row[];
}

const usd0 = (v: number) => formatCurrency(v, { maximumFractionDigits: 0 });
const missing = (label = "Not provided"): Cell => ({ display: label, tone: "missing" });

/** Indexes holding the best known value; empty unless ≥2 values are known and they differ. */
function bestIdx(values: (number | null)[], lowerIsBetter: boolean): Set<number> {
  const known = values.filter((v): v is number => v != null);
  if (known.length < 2) return new Set();
  const target = lowerIsBetter ? Math.min(...known) : Math.max(...known);
  if (Math.min(...known) === Math.max(...known)) return new Set();
  return new Set(values.flatMap((v, i) => (v === target ? [i] : [])));
}

function numericRow(
  key: string,
  label: string,
  values: (number | null)[],
  fmt: (v: number) => string,
  lowerIsBetter: boolean,
  opts: { tooltip?: string; sub?: (i: number) => string | undefined; missingLabel?: string } = {}
): Row {
  const best = bestIdx(values, lowerIsBetter);
  return {
    key,
    label,
    tooltip: opts.tooltip,
    cells: values.map((v, i) =>
      v == null ? missing(opts.missingLabel) : { display: fmt(v), sub: opts.sub?.(i), tone: best.has(i) ? "best" : "neutral" }
    ),
  };
}

function textRow(key: string, label: string, values: (string | null)[]): Row {
  return { key, label, cells: values.map((v) => (v ? { display: v, tone: "neutral" } : missing("Not stated"))) };
}

function buildGroups(suppliers: SupplierComparison[], requiredQuantity: number): Group[] {
  const lc = suppliers.map((s) => s.landedCost);
  const priced = (i: number) => lc[i].effectiveUnitCost != null;
  const minimumNote = (i: number) =>
    priced(i) && !lc[i].costComplete ? `Minimum — excludes ${lc[i].missingFields.join(", ").toLowerCase()}` : undefined;

  // ---- Economics
  const landed = numericRow(
    "landed",
    "Total landed cost",
    lc.map((l, i) => (priced(i) ? l.totalLandedCost : null)),
    usd0,
    true,
    {
      tooltip: `At ${requiredQuantity.toLocaleString()} units: purchase cost after volume discount + freight + taxes/fees + setup and other fees − payment-terms value. Unknown components are excluded, never assumed zero.`,
      sub: minimumNote,
      missingLabel: "No unit price",
    }
  );
  // An incomplete total is a lower bound, so flag it amber rather than green even when it's lowest.
  landed.cells = landed.cells.map((c, i) => (c.tone !== "missing" && !lc[i].costComplete ? { ...c, tone: "missing" } : c));

  const bestCost = Math.min(...lc.filter((_, i) => priced(i)).map((l) => l.totalLandedCost));
  const vsLowest: Row = {
    key: "vs-lowest",
    label: "Difference vs. lowest",
    cells: lc.map((l, i) => {
      if (!priced(i)) return missing("—");
      const diff = l.totalLandedCost - bestCost;
      if (diff === 0) return { display: "Lowest", tone: "best" };
      return { display: `+${usd0(diff)}`, sub: `+${((diff / bestCost) * 100).toFixed(1)}%`, tone: "neutral" };
    }),
  };

  const economics: Group = {
    key: "economics",
    label: "Economics",
    economic: true,
    primary: [
      numericRow("unit-price", "Unit price", suppliers.map((s) => s.quote.unitPrice), (v) => formatCurrency(v), true),
      landed,
      numericRow("effective-unit", "Effective unit cost", lc.map((l) => l.effectiveUnitCost), (v) => formatCurrency(v), true, {
        tooltip: "Total landed cost ÷ required quantity — the per-unit figure used for price scoring.",
        missingLabel: "No unit price",
      }),
      vsLowest,
    ],
    secondary: [
      numericRow(
        "quoted-total",
        "Quoted total",
        suppliers.map((s) => s.quote.totalQuotedPrice ?? (s.quote.unitPrice != null && s.quote.quantity != null ? s.quote.unitPrice * s.quote.quantity : null)),
        usd0,
        true,
        {
          tooltip: "As stated on the quote, at the supplier's own quoted quantity — not adjusted to your required quantity.",
          sub: (i) => (suppliers[i].quote.quantity != null ? `at ${formatNumber(suppliers[i].quote.quantity)} units` : undefined),
        }
      ),
      numericRow("freight", "Freight / shipping", lc.map((l) => l.shippingCost), usd0, true, {
        tooltip: "Scaled to your required quantity when the quote states the quantity it was written for.",
      }),
      numericRow("taxes", "Taxes / fees", lc.map((l) => l.taxesFees), usd0, true),
      numericRow("setup", "Setup fee", lc.map((l) => l.setupFees), usd0, true, { tooltip: "One-time; not scaled with quantity." }),
      numericRow("other-fees", "Other fees", lc.map((l) => l.otherFees), usd0, true, {
        sub: (i) => suppliers[i].quote.otherFeesDescription ?? undefined,
      }),
      {
        key: "discount",
        label: "Volume discount",
        tooltip: "Discount applied at your required quantity, from the supplier's stated tiers.",
        cells: suppliers.map((s) => {
          const applied = s.landedCost.discountApplied;
          if (applied) return { display: `${applied.percent}% applied`, sub: `−${usd0(s.landedCost.discountAmount)}`, tone: "best" as Tone };
          if (s.quote.volumeDiscounts.length > 0) {
            const next = Math.min(...s.quote.volumeDiscounts.map((t) => t.minQuantity));
            return { display: "Not reached", sub: `Tier starts at ${formatNumber(next)} units`, tone: "neutral" as Tone };
          }
          return { display: "None offered", tone: "neutral" as Tone };
        }),
      },
      numericRow(
        "payment-value",
        "Payment-terms value",
        suppliers.map((s) => (priced(suppliers.indexOf(s)) && isPaymentTermsQuantifiable(s.quote.paymentTerms) ? s.landedCost.paymentTermsValue : null)),
        usd0,
        false,
        { tooltip: "Value of paying later at your cost of capital. Already credited in landed cost.", missingLabel: "Can't be valued" }
      ),
    ],
  };

  // ---- Delivery & operations
  const delivery: Group = {
    key: "delivery",
    label: "Delivery & operations",
    economic: false,
    primary: [
      numericRow("lead-time", "Lead time", suppliers.map((s) => s.quote.leadTimeDays), (v) => `${v} days`, true),
      {
        key: "moq",
        label: "Minimum order qty",
        cells: suppliers.map((s) => {
          if (s.quote.minimumOrderQuantity == null) return missing("Not stated");
          return s.landedCost.belowMinimumOrderQuantity
            ? { display: `${formatNumber(s.quote.minimumOrderQuantity)} units`, sub: "Above your required quantity", tone: "risk" as Tone }
            : { display: `${formatNumber(s.quote.minimumOrderQuantity)} units`, tone: "neutral" as Tone };
        }),
      },
    ],
    secondary: [
      numericRow("reliability", "Reliability rating", suppliers.map((s) => s.quote.reliabilityRating), (v) => `${v} / 5`, false, {
        tooltip: "Your own rating.",
        missingLabel: "Not rated",
      }),
      textRow("location", "Location", suppliers.map((s) => s.quote.supplierLocation)),
    ],
  };

  // ---- Commercial terms
  const now = Date.now();
  const commercial: Group = {
    key: "commercial",
    label: "Commercial terms",
    economic: false,
    primary: [
      {
        key: "payment-terms",
        label: "Payment terms",
        cells: suppliers.map((s) =>
          isPaymentTermsQuantifiable(s.quote.paymentTerms)
            ? { display: paymentTermsLabel(s.quote.paymentTerms), tone: "neutral" as Tone }
            : { display: paymentTermsLabel(s.quote.paymentTerms), sub: "Days not stated", tone: "missing" as Tone }
        ),
      },
      {
        key: "expiration",
        label: "Quote expires",
        cells: suppliers.map((s) => {
          if (!s.quote.quoteExpirationDate) return missing("Not stated");
          const days = Math.ceil((new Date(s.quote.quoteExpirationDate).getTime() - now) / 86_400_000);
          return {
            display: formatDate(s.quote.quoteExpirationDate),
            sub: days < 0 ? "Expired" : `${days} day${days === 1 ? "" : "s"} left`,
            tone: (days <= 7 ? "risk" : "neutral") as Tone,
          };
        }),
      },
      {
        key: "contract",
        label: "Contract commitment",
        cells: suppliers.map((s) => {
          const m = s.quote.contractLengthMonths;
          if (m == null) return missing("Not stated");
          return { display: m === 0 ? "None" : `${m} months`, tone: "neutral" as Tone };
        }),
      },
    ],
    secondary: [
      textRow("warranty", "Warranty", suppliers.map((s) => s.quote.warranty)),
      textRow("returns", "Return policy", suppliers.map((s) => s.quote.returnPolicy)),
      textRow("cancellation", "Cancellation", suppliers.map((s) => s.quote.cancellationTerms)),
      {
        key: "recurring",
        label: "Recurring fees",
        cells: suppliers.map((s) =>
          s.quote.recurringFees == null
            ? { display: "None stated", tone: "neutral" as Tone }
            : { display: `${usd0(s.quote.recurringFees)} / ${s.quote.recurringFeePeriod ?? "period"}`, tone: "neutral" as Tone }
        ),
      },
    ],
  };

  return [economics, delivery, commercial];
}

export function ComparisonTable({ comparison, requiredQuantity }: { comparison: ComparisonResult; requiredQuantity: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const suppliers = comparison.suppliers;

  if (suppliers.length === 0) return null;
  const groups = buildGroups(suppliers, requiredQuantity);
  const cols = suppliers.length + 1;

  return (
    <section>
      <SectionHeading
        title="Comparison"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Side-by-side terms at {requiredQuantity.toLocaleString()} units.</span>
            <span className="inline-flex items-center gap-3 text-xs">
              <Legend className="bg-success" label="Best economics" />
              <Legend className="bg-warning" label="Missing / incomplete" />
              <Legend className="bg-destructive" label="Material risk" />
            </span>
          </span>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-44" />
            {suppliers.map((s) => (
              <col key={s.quote.id} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-5 py-3" />
              {suppliers.map((s) => {
                const isRec = comparison.bestScoreSupplierId === s.quote.id;
                return (
                  <th key={s.quote.id} className="px-4 py-3 text-left align-bottom">
                    {isRec && <p className="mb-0.5 text-2xs font-semibold uppercase tracking-wider text-primary">Recommended</p>}
                    <p className="truncate text-sm font-semibold" title={s.quote.supplierName}>
                      {s.quote.supplierName || "Untitled"}
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const open = expanded[g.key] ?? false;
              const rows = open ? [...g.primary, ...g.secondary] : g.primary;
              return (
                <Fragment key={g.key}>
                  <tr>
                    <td colSpan={cols} className="bg-muted/60 px-5 pb-1.5 pt-4 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {g.label}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="sticky left-0 z-10 bg-card px-5 py-2.5 text-left align-top text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          {row.label}
                          {row.tooltip && <InfoTooltip text={row.tooltip} />}
                        </span>
                      </th>
                      {row.cells.map((cell, i) => (
                        <td key={i} className="px-4 py-2.5 align-top">
                          <p
                            className={cn(
                              "truncate tabular-nums",
                              cell.tone === "best" && (g.economic ? "font-semibold text-success" : "font-semibold"),
                              cell.tone === "missing" && "text-warning",
                              cell.tone === "risk" && "font-medium text-destructive"
                            )}
                            title={cell.display}
                          >
                            {cell.display}
                          </p>
                          {cell.sub && (
                            <p className={cn("truncate text-2xs", cell.tone === "missing" ? "text-warning" : "text-muted-foreground")} title={cell.sub}>
                              {cell.sub}
                            </p>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {g.secondary.length > 0 && (
                    <tr className="border-b border-border/60">
                      <td colSpan={cols} className="px-5 py-1.5">
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [g.key]: !open }))}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          aria-expanded={open}
                        >
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                          {open ? "Show fewer" : `Show ${g.secondary.length} more: ${g.secondary.map((r) => r.label.toLowerCase()).join(", ")}`}
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-sm", className)} />
      {label}
    </span>
  );
}
