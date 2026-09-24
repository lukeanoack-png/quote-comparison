import type { SupplierQuote } from "./types";

/**
 * DEMO DATA — fictional suppliers and fictional pricing, used only to
 * demonstrate the application. Blue Ridge Industrial Supply, Summit
 * Components, and Atlas Manufacturing are not real companies. No claims in
 * this file are sourced from real supplier data.
 *
 * What the numbers show at the default 1,000 units:
 *  - Blue Ridge (incumbent) has the lowest unit price and the lowest total
 *    landed cost, but the slowest delivery, Net 15 terms, and a quote that
 *    expires in 5 days.
 *  - Summit costs ~$570 more (setup fee, higher unit price; free shipping and
 *    Net 60 offset part of it) but delivers twice as fast and is rated more
 *    reliable — so it wins the default weighted score.
 *  - Atlas is fastest and best-rated, but most expensive, requires a 12-month
 *    contract, and doesn't state taxes/fees (so its landed cost is a minimum).
 *  - Neither Blue Ridge nor Summit states a contract length; flexibility is
 *    therefore unscored for them rather than assumed.
 * At 5,000 units Summit's 9% volume discount makes it the lowest cost too.
 * Raise the price weight to ~80% and Blue Ridge becomes the recommendation.
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
