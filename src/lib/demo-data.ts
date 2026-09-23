import type { SupplierQuote } from "./types";

/**
 * DEMO DATA — fictional suppliers and fictional pricing, used only to
 * demonstrate the application. Blue Ridge Industrial Supply, Summit
 * Components, and Atlas Manufacturing are not real companies. No claims in
 * this file are sourced from real supplier data.
 *
 * The numbers are deliberately tuned so that:
 *  - Blue Ridge has the lowest sticker unit price, but is NOT the lowest
 *    total landed cost, because it charges more for shipping and offers no
 *    payment-term financing value (Net 15).
 *  - Summit has a slightly higher unit price but free shipping, Net 60
 *    terms, and a volume discount — making it the lowest total landed cost,
 *    and by a wider margin once volume climbs past its discount threshold.
 *  - Atlas is the most expensive on cost, but fastest lead time, best
 *    warranty, and lowest minimum order quantity — at the cost of a 12-month
 *    contract commitment.
 * Change the "required quantity" scenario control to see the ranking shift.
 */

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getDemoQuotes(): SupplierQuote[] {
  return [
    {
      id: "demo-blue-ridge",
      supplierName: "Blue Ridge Industrial Supply",
      productService: "Steel Bracket Assembly — Model SB-200",
      quantity: 1000,
      unitPrice: 18.25,
      totalQuotedPrice: 18250,
      shippingCost: 1800,
      taxesFees: 550,
      minimumOrderQuantity: 250,
      volumeDiscounts: [{ id: "br-vd-1", minQuantity: 5000, discountPercent: 4 }],
      leadTimeDays: 28,
      paymentTerms: { type: "net", netDays: 15, depositPercent: null, description: null },
      quoteExpirationDate: daysFromNow(5),
      contractLengthMonths: null,
      warranty: "90-day limited warranty on manufacturing defects",
      returnPolicy: "15% restocking fee on returns within 30 days",
      cancellationTerms: "Orders cannot be cancelled once in production",
      setupFees: 0,
      recurringFees: null,
      recurringFeePeriod: null,
      otherFees: 0,
      otherFeesDescription: null,
      notes: "Bulk steel bracket assemblies, powder-coated finish.",
      supplierLocation: "Charlotte, NC",
      isIncumbent: true,
      qualitativeComments:
        "Long-standing relationship and a responsive account rep, but has missed delivery windows twice in the past year.",
      reliabilityRating: 3,
      source: { method: "manual", retrievedAt: null, reference: null },
    },
    {
      id: "demo-summit",
      supplierName: "Summit Components",
      productService: "Steel Bracket Assembly — Model SB-200",
      quantity: 1000,
      unitPrice: 19.1,
      totalQuotedPrice: 19100,
      shippingCost: 0,
      taxesFees: 540,
      minimumOrderQuantity: 500,
      volumeDiscounts: [{ id: "sc-vd-1", minQuantity: 5000, discountPercent: 9 }],
      leadTimeDays: 14,
      paymentTerms: { type: "net", netDays: 60, depositPercent: null, description: null },
      quoteExpirationDate: daysFromNow(30),
      contractLengthMonths: null,
      warranty: "1-year warranty against manufacturing defects",
      returnPolicy: null,
      cancellationTerms: "Cancellations accepted up to 5 business days before production start",
      setupFees: 1800,
      recurringFees: null,
      recurringFeePeriod: null,
      otherFees: 0,
      otherFeesDescription: null,
      notes: "Volume discount applies automatically at 5,000+ units. Setup fee covers tooling for this part.",
      supplierLocation: "Dayton, OH",
      isIncumbent: false,
      qualitativeComments:
        "New vendor relationship established this year; strong on-time delivery track record so far per references.",
      reliabilityRating: 4,
      source: { method: "manual", retrievedAt: null, reference: null },
    },
    {
      id: "demo-atlas",
      supplierName: "Atlas Manufacturing",
      productService: "Steel Bracket Assembly — Model SB-200",
      quantity: 1000,
      unitPrice: 21.5,
      totalQuotedPrice: 21500,
      shippingCost: 900,
      taxesFees: null,
      minimumOrderQuantity: 100,
      volumeDiscounts: [],
      leadTimeDays: 10,
      paymentTerms: { type: "net", netDays: 30, depositPercent: null, description: null },
      quoteExpirationDate: daysFromNow(45),
      contractLengthMonths: 12,
      warranty: "3-year comprehensive warranty, including labor",
      returnPolicy: "Full refund within 60 days, no restocking fee",
      cancellationTerms: "Cancel anytime with 30 days notice",
      setupFees: 0,
      recurringFees: null,
      recurringFeePeriod: null,
      otherFees: 300,
      otherFeesDescription: "Compliance documentation fee",
      notes: "Premium-tier supplier; requires a 12-month supply agreement.",
      supplierLocation: "Portland, OR",
      isIncumbent: false,
      qualitativeComments: "Highest quality ratings in initial samples; sales engineer proactive about specs.",
      reliabilityRating: 5,
      source: { method: "manual", retrievedAt: null, reference: null },
    },
  ];
}
