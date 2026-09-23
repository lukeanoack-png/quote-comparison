"use client";

import { Star } from "lucide-react";
import { RankDot, rankValues, type RankStatus } from "@/components/rank-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/tooltip";
import type { ComparisonResult } from "@/lib/calculations";
import { paymentTermsLabel } from "@/lib/calculations";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Cell {
  display: string;
  sub?: string;
  status: RankStatus;
}

interface Row {
  key: string;
  label: string;
  tooltip?: string;
  cells: Cell[];
}

export function ComparisonTable({ comparison }: { comparison: ComparisonResult }) {
  const suppliers = comparison.suppliers;
  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Add at least one supplier quote to see a comparison.
        </CardContent>
      </Card>
    );
  }

  const rows: Row[] = [];

  const quotedPrice = suppliers.map((s) => s.quote.totalQuotedPrice ?? (s.quote.unitPrice != null && s.quote.quantity != null ? s.quote.unitPrice * s.quote.quantity : null));
  rows.push({
    key: "quoted-price",
    label: "Quoted total price",
    tooltip: "As stated on the quote, at the supplier's originally quoted quantity — not adjusted to your required quantity.",
    cells: quotedPrice.map((v, i) => ({
      display: v != null ? formatCurrency(v, { maximumFractionDigits: 0 }) : "Not specified",
      sub: suppliers[i].quote.quantity != null ? `at ${formatNumber(suppliers[i].quote.quantity)} units` : undefined,
      status: "neutral",
    })),
  });

  const unitPrice = suppliers.map((s) => s.quote.unitPrice);
  const unitPriceRank = rankValues(unitPrice, true);
  rows.push({
    key: "unit-price",
    label: "Unit price",
    cells: unitPrice.map((v, i) => ({ display: v != null ? formatCurrency(v) : "Not specified", status: unitPriceRank[i] })),
  });

  const shipping = suppliers.map((s) => s.landedCost.shippingCost);
  const shippingRank = rankValues(shipping, true);
  rows.push({
    key: "freight",
    label: "Freight / shipping",
    tooltip: "Scaled to your required quantity when the quote specified an original quantity.",
    cells: shipping.map((v, i) => ({ display: v != null ? formatCurrency(v, { maximumFractionDigits: 0 }) : "Not specified", status: shippingRank[i] })),
  });

  const landed = suppliers.map((s) => s.landedCost.totalLandedCost);
  const landedRank = rankValues(landed, true);
  rows.push({
    key: "total-landed-cost",
    label: "Total landed cost",
    tooltip: "Base cost (after volume discount) + shipping + taxes/fees + setup/other fees − payment-terms value, at your required quantity.",
    cells: landed.map((v, i) => ({
      display: formatCurrency(v, { maximumFractionDigits: 0 }),
      sub: suppliers[i].landedCost.missingFields.length > 0 ? "Incomplete data" : undefined,
      status: landedRank[i],
    })),
  });

  const effUnit = suppliers.map((s) => s.landedCost.effectiveUnitCost);
  const effUnitRank = rankValues(effUnit, true);
  rows.push({
    key: "effective-unit-cost",
    label: "Effective unit cost",
    tooltip: "Total landed cost ÷ required quantity — the true per-unit economic cost.",
    cells: effUnit.map((v, i) => ({ display: v != null ? formatCurrency(v) : "Unknown", status: effUnitRank[i] })),
  });

  const leadTime = suppliers.map((s) => s.quote.leadTimeDays);
  const leadTimeRank = rankValues(leadTime, true);
  rows.push({
    key: "lead-time",
    label: "Lead time",
    cells: leadTime.map((v, i) => ({ display: v != null ? `${v} days` : "Not specified", status: leadTimeRank[i] })),
  });

  const paymentValue = suppliers.map((s) => s.landedCost.paymentTermsValue);
  const paymentRank = rankValues(paymentValue, false);
  rows.push({
    key: "payment-terms",
    label: "Payment terms",
    tooltip: "Ranked by the dollar value of delayed payment (time value of money), not just the number of days.",
    cells: suppliers.map((s, i) => ({
      display: paymentTermsLabel(s.quote.paymentTerms),
      sub: s.landedCost.paymentTermsValue > 0 ? `+${formatCurrency(s.landedCost.paymentTermsValue, { maximumFractionDigits: 0 })} value` : undefined,
      status: paymentRank[i],
    })),
  });

  const moq = suppliers.map((s) => s.quote.minimumOrderQuantity);
  const moqRank = rankValues(moq, true);
  rows.push({
    key: "moq",
    label: "Minimum order qty",
    cells: suppliers.map((s, i) => ({
      display: moq[i] != null ? `${formatNumber(moq[i])} units` : "Not specified",
      sub: s.landedCost.belowMinimumOrderQuantity ? "Below your required qty" : undefined,
      status: s.landedCost.belowMinimumOrderQuantity ? "unfavorable" : moqRank[i],
    })),
  });

  const discountPct = suppliers.map((s) => s.landedCost.discountApplied?.percent ?? 0);
  const discountRank = rankValues(discountPct, false);
  rows.push({
    key: "volume-discount",
    label: "Volume discount",
    tooltip: "Discount applied at your required quantity, based on the supplier's stated tiers.",
    cells: suppliers.map((s, i) => {
      const applied = s.landedCost.discountApplied;
      const hasTiers = s.quote.volumeDiscounts.length > 0;
      return {
        display: applied ? `${applied.percent}% off` : hasTiers ? "Not reached at this qty" : "None offered",
        sub: hasTiers && !applied ? `Next tier at ${formatNumber(Math.min(...s.quote.volumeDiscounts.map((t) => t.minQuantity)))} units` : undefined,
        status: applied ? discountRank[i] : "neutral",
      };
    }),
  });

  rows.push({
    key: "warranty",
    label: "Warranty / guarantee",
    cells: suppliers.map((s) => ({
      display: s.quote.warranty || "Not specified",
      status: s.quote.warranty ? "neutral" : "missing",
    })),
  });

  const contractMonths = suppliers.map((s) => s.quote.contractLengthMonths ?? 0);
  const contractRank = rankValues(contractMonths, true);
  rows.push({
    key: "contract",
    label: "Contract commitment",
    cells: suppliers.map((s, i) => ({
      display: s.quote.contractLengthMonths != null ? `${s.quote.contractLengthMonths}-month commitment` : "No commitment specified",
      status: contractRank[i],
    })),
  });

  rows.push({
    key: "setup-fee",
    label: "Setup fee",
    cells: suppliers.map((s) => ({
      display: s.quote.setupFees != null ? formatCurrency(s.quote.setupFees, { maximumFractionDigits: 0 }) : "Not specified",
      status: s.quote.setupFees == null ? "missing" : s.quote.setupFees === 0 ? "best" : "neutral",
    })),
  });

  const now = Date.now();
  rows.push({
    key: "expiration",
    label: "Quote expires",
    cells: suppliers.map((s) => {
      if (!s.quote.quoteExpirationDate) return { display: "Not specified", status: "missing" as RankStatus };
      const days = Math.ceil((new Date(s.quote.quoteExpirationDate).getTime() - now) / (1000 * 60 * 60 * 24));
      return {
        display: formatDate(s.quote.quoteExpirationDate),
        sub: days < 0 ? "Expired" : `${days} day(s) left`,
        status: days <= 7 ? "unfavorable" : "neutral",
      };
    }),
  });

  rows.push({
    key: "return-policy",
    label: "Return policy",
    cells: suppliers.map((s) => ({ display: s.quote.returnPolicy || "Not specified", status: s.quote.returnPolicy ? "neutral" : "missing" })),
  });

  rows.push({
    key: "cancellation",
    label: "Cancellation terms",
    cells: suppliers.map((s) => ({ display: s.quote.cancellationTerms || "Not specified", status: s.quote.cancellationTerms ? "neutral" : "missing" })),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Comparison table</CardTitle>
        <Legend />
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 w-48 bg-card px-5 py-3 text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                Factor
              </th>
              {suppliers.map((s) => (
                <th key={s.quote.id} className="px-4 py-3 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold">{s.quote.supplierName || "Untitled"}</span>
                    {s.quote.isIncumbent && <Star className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    {comparison.bestCostSupplierId === s.quote.id && (
                      <Badge variant="success" className="shrink-0">Lowest cost</Badge>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="sticky left-0 z-10 bg-card px-5 py-2.5 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {row.label}
                    {row.tooltip && <InfoTooltip text={row.tooltip} />}
                  </span>
                </td>
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-4 py-2.5 align-top">
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-4 items-center">
                        <RankDot status={cell.status} />
                      </span>
                      <div className="min-w-0">
                        <p className={cn("truncate text-xs font-medium", cell.status === "missing" && "italic text-muted-foreground")}>{cell.display}</p>
                        {cell.sub && <p className="truncate text-[10px] text-muted-foreground">{cell.sub}</p>}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Legend() {
  const items: { status: RankStatus; label: string }[] = [
    { status: "best", label: "Best" },
    { status: "second", label: "2nd best" },
    { status: "unfavorable", label: "Unfavorable" },
    { status: "missing", label: "Missing" },
  ];
  return (
    <div className="flex items-center gap-3">
      {items.map((it) => (
        <span key={it.status} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <RankDot status={it.status} /> {it.label}
        </span>
      ))}
    </div>
  );
}
