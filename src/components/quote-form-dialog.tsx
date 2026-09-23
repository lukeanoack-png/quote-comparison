"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NumberField } from "@/components/number-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/tooltip";
import { emptyQuote, type PaymentTermType, type SupplierQuote, type VolumeDiscountTier } from "@/lib/types";
import { uid } from "@/lib/utils";

interface QuoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuote: SupplierQuote | null;
  onSave: (quote: SupplierQuote) => void;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-b border-border pb-5 last:border-0 last:pb-0">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {description && <p className="text-2xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function QuoteFormDialog({ open, onOpenChange, initialQuote, onSave }: QuoteFormDialogProps) {
  const [quote, setQuote] = useState<SupplierQuote>(() => initialQuote ?? emptyQuote(uid("supplier")));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setQuote(initialQuote ?? emptyQuote(uid("supplier")));
      setErrors({});
    }
  }, [open, initialQuote]);

  function patch(partial: Partial<SupplierQuote>) {
    setQuote((q) => ({ ...q, ...partial }));
  }

  function patchPaymentTerms(partial: Partial<SupplierQuote["paymentTerms"]>) {
    setQuote((q) => ({ ...q, paymentTerms: { ...q.paymentTerms, ...partial } }));
  }

  function addDiscountTier() {
    const tier: VolumeDiscountTier = { id: uid("tier"), minQuantity: 0, discountPercent: 0 };
    patch({ volumeDiscounts: [...quote.volumeDiscounts, tier] });
  }

  function updateDiscountTier(id: string, partial: Partial<VolumeDiscountTier>) {
    patch({ volumeDiscounts: quote.volumeDiscounts.map((t) => (t.id === id ? { ...t, ...partial } : t)) });
  }

  function removeDiscountTier(id: string) {
    patch({ volumeDiscounts: quote.volumeDiscounts.filter((t) => t.id !== id) });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!quote.supplierName.trim()) next.supplierName = "Supplier name is required.";
    const nonNegativeFields: [keyof SupplierQuote, string][] = [
      ["quantity", "Quantity"],
      ["unitPrice", "Unit price"],
      ["totalQuotedPrice", "Total quoted price"],
      ["shippingCost", "Shipping cost"],
      ["taxesFees", "Taxes / fees"],
      ["minimumOrderQuantity", "Minimum order quantity"],
      ["leadTimeDays", "Lead time"],
      ["contractLengthMonths", "Contract length"],
      ["setupFees", "Setup fees"],
      ["recurringFees", "Recurring fees"],
      ["otherFees", "Other fees"],
    ];
    for (const [key, label] of nonNegativeFields) {
      const v = quote[key];
      if (typeof v === "number" && v < 0) next[key] = `${label} cannot be negative.`;
    }
    if (quote.reliabilityRating != null && (quote.reliabilityRating < 1 || quote.reliabilityRating > 5)) {
      next.reliabilityRating = "Reliability rating must be between 1 and 5.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave(quote);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialQuote ? "Edit supplier quote" : "Add supplier quote"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
          <Section title="Supplier">
            <div className="col-span-2 space-y-1.5">
              <Label>Supplier name *</Label>
              <Input value={quote.supplierName} onChange={(e) => patch({ supplierName: e.target.value })} placeholder="e.g. Acme Industrial Supply" />
              {errors.supplierName && <p className="text-2xs text-destructive">{errors.supplierName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Product / service</Label>
              <Input value={quote.productService} onChange={(e) => patch({ productService: e.target.value })} placeholder="e.g. Steel bracket assembly" />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier location</Label>
              <Input value={quote.supplierLocation ?? ""} onChange={(e) => patch({ supplierLocation: e.target.value || null })} placeholder="City, state / country" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox checked={quote.isIncumbent} onCheckedChange={(c) => patch({ isIncumbent: c === true })} id="incumbent" />
              <Label htmlFor="incumbent" className="cursor-pointer">
                Incumbent / previously used supplier
              </Label>
            </div>
          </Section>

          <Section title="Pricing" description="Quantity and unit price the quote was written for.">
            <NumberField label="Quantity quoted" value={quote.quantity} onChange={(v) => patch({ quantity: v })} suffix="units" error={errors.quantity} />
            <NumberField label="Unit price" value={quote.unitPrice} onChange={(v) => patch({ unitPrice: v })} prefix="$" error={errors.unitPrice} />
            <NumberField
              label="Total quoted price"
              value={quote.totalQuotedPrice}
              onChange={(v) => patch({ totalQuotedPrice: v })}
              prefix="$"
              tooltip="As stated on the quote. If left blank, it's derived from unit price × quantity."
              error={errors.totalQuotedPrice}
            />
            <NumberField label="Minimum order quantity" value={quote.minimumOrderQuantity} onChange={(v) => patch({ minimumOrderQuantity: v })} suffix="units" error={errors.minimumOrderQuantity} />
          </Section>

          <Section title="Shipping, taxes & fees">
            <NumberField label="Shipping / freight cost" value={quote.shippingCost} onChange={(v) => patch({ shippingCost: v })} prefix="$" error={errors.shippingCost} />
            <NumberField label="Taxes / fees" value={quote.taxesFees} onChange={(v) => patch({ taxesFees: v })} prefix="$" error={errors.taxesFees} />
            <NumberField label="Setup fee (one-time)" value={quote.setupFees} onChange={(v) => patch({ setupFees: v })} prefix="$" error={errors.setupFees} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Recurring fee" value={quote.recurringFees} onChange={(v) => patch({ recurringFees: v })} prefix="$" error={errors.recurringFees} />
              <div className="space-y-1.5">
                <Label>Per</Label>
                <Select value={quote.recurringFeePeriod ?? undefined} onValueChange={(v) => patch({ recurringFeePeriod: v as "month" | "year" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <NumberField label="Other fees" value={quote.otherFees} onChange={(v) => patch({ otherFees: v })} prefix="$" error={errors.otherFees} />
            <div className="space-y-1.5">
              <Label>Other fees description</Label>
              <Input value={quote.otherFeesDescription ?? ""} onChange={(e) => patch({ otherFeesDescription: e.target.value || null })} placeholder="e.g. Compliance documentation fee" />
            </div>
          </Section>

          <Section title="Volume discounts" description="Discount tiers applied automatically at or above a minimum quantity.">
            <div className="col-span-2 space-y-2">
              {quote.volumeDiscounts.map((tier) => (
                <div key={tier.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-32"
                    value={tier.minQuantity}
                    onChange={(e) => updateDiscountTier(tier.id, { minQuantity: Number(e.target.value) || 0 })}
                    placeholder="Min qty"
                  />
                  <span className="text-xs text-muted-foreground">units →</span>
                  <Input
                    type="number"
                    className="w-24"
                    value={tier.discountPercent}
                    onChange={(e) => updateDiscountTier(tier.id, { discountPercent: Number(e.target.value) || 0 })}
                    placeholder="%"
                  />
                  <span className="text-xs text-muted-foreground">% off</span>
                  <Button variant="ghost" size="icon" onClick={() => removeDiscountTier(tier.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addDiscountTier}>
                <Plus className="h-3.5 w-3.5" />
                Add discount tier
              </Button>
            </div>
          </Section>

          <Section title="Payment terms">
            <div className="space-y-1.5">
              <Label>Terms type</Label>
              <Select value={quote.paymentTerms.type} onValueChange={(v) => patchPaymentTerms({ type: v as PaymentTermType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Due immediately</SelectItem>
                  <SelectItem value="net">Net terms</SelectItem>
                  <SelectItem value="deposit">Deposit + remainder</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {quote.paymentTerms.type === "net" && (
              <NumberField label="Net days" value={quote.paymentTerms.netDays} onChange={(v) => patchPaymentTerms({ netDays: v })} suffix="days" />
            )}
            {quote.paymentTerms.type === "deposit" && (
              <>
                <NumberField label="Deposit %" value={quote.paymentTerms.depositPercent} onChange={(v) => patchPaymentTerms({ depositPercent: v })} suffix="%" />
                <NumberField label="Remainder due (net days)" value={quote.paymentTerms.netDays} onChange={(v) => patchPaymentTerms({ netDays: v })} suffix="days" />
              </>
            )}
            {quote.paymentTerms.type === "custom" && (
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Input value={quote.paymentTerms.description ?? ""} onChange={(e) => patchPaymentTerms({ description: e.target.value || null })} placeholder="Describe the payment schedule" />
              </div>
            )}
          </Section>

          <Section title="Timing & commitment">
            <div className="space-y-1.5">
              <Label>Quote expiration date</Label>
              <Input type="date" value={quote.quoteExpirationDate ?? ""} onChange={(e) => patch({ quoteExpirationDate: e.target.value || null })} />
            </div>
            <NumberField label="Lead time" value={quote.leadTimeDays} onChange={(v) => patch({ leadTimeDays: v })} suffix="days" error={errors.leadTimeDays} />
            <NumberField
              label="Contract length"
              value={quote.contractLengthMonths}
              onChange={(v) => patch({ contractLengthMonths: v })}
              suffix="months"
              tooltip="Leave blank if this is a one-time purchase with no ongoing commitment."
              error={errors.contractLengthMonths}
            />
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Reliability rating
                <InfoTooltip text="Your own subjective 1-5 rating of this supplier. Never inferred automatically." />
              </Label>
              <Select
                value={quote.reliabilityRating?.toString() ?? undefined}
                onValueChange={(v) => patch({ reliabilityRating: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not rated" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} / 5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section title="Terms & policies">
            <div className="space-y-1.5">
              <Label>Warranty / guarantee</Label>
              <Input value={quote.warranty ?? ""} onChange={(e) => patch({ warranty: e.target.value || null })} placeholder="e.g. 1-year warranty" />
            </div>
            <div className="space-y-1.5">
              <Label>Return policy</Label>
              <Input value={quote.returnPolicy ?? ""} onChange={(e) => patch({ returnPolicy: e.target.value || null })} placeholder="e.g. 30-day returns" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Cancellation terms</Label>
              <Input value={quote.cancellationTerms ?? ""} onChange={(e) => patch({ cancellationTerms: e.target.value || null })} placeholder="e.g. Cancel with 30 days notice" />
            </div>
          </Section>

          <Section title="Notes">
            <div className="col-span-2 space-y-1.5">
              <Label>Internal notes</Label>
              <Textarea value={quote.notes ?? ""} onChange={(e) => patch({ notes: e.target.value || null })} placeholder="Anything else worth remembering about this quote" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Qualitative comments</Label>
              <Textarea
                value={quote.qualitativeComments ?? ""}
                onChange={(e) => patch({ qualitativeComments: e.target.value || null })}
                placeholder="Subjective impressions — communication, responsiveness, references, etc."
              />
            </div>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save quote</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
