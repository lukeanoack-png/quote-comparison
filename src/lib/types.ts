/**
 * Core data model for supplier quote comparison.
 *
 * Design note: every commercial field is `number | null` (or `string | null`)
 * rather than defaulting to 0/"" . Calculations must treat `null` as "unknown"
 * and surface that explicitly instead of silently assuming a value. See
 * lib/calculations/risk-flags.ts.
 */

export type PaymentTermType = "immediate" | "net" | "deposit" | "custom";

export interface PaymentTerms {
  type: PaymentTermType;
  /** Days until payment is due, relative to delivery/invoice. 0 = due immediately. */
  netDays: number | null;
  /** For "deposit": percentage due upfront before delivery (0-100). */
  depositPercent: number | null;
  /** Free-text description, used for "custom" or to capture extra nuance. */
  description: string | null;
}

export interface VolumeDiscountTier {
  id: string;
  /** Minimum quantity at which this discount tier applies. */
  minQuantity: number;
  /** Discount percentage applied to base purchase cost at/above this quantity. */
  discountPercent: number;
}

export interface SupplierQuote {
  id: string;
  supplierName: string;
  productService: string;

  /** Quantity the quote was originally written for. */
  quantity: number | null;
  unitPrice: number | null;
  /**
   * Total quoted price as stated on the quote, at `quantity` units.
   * If null, it is derived from unitPrice * quantity.
   */
  totalQuotedPrice: number | null;

  shippingCost: number | null;
  taxesFees: number | null;

  minimumOrderQuantity: number | null;
  volumeDiscounts: VolumeDiscountTier[];

  leadTimeDays: number | null;
  paymentTerms: PaymentTerms;
  quoteExpirationDate: string | null; // ISO date string
  contractLengthMonths: number | null;

  warranty: string | null;
  returnPolicy: string | null;
  cancellationTerms: string | null;

  setupFees: number | null;
  recurringFees: number | null;
  recurringFeePeriod: "month" | "year" | null;
  otherFees: number | null;
  otherFeesDescription: string | null;

  notes: string | null;
  supplierLocation: string | null;
  isIncumbent: boolean;
  qualitativeComments: string | null;

  /**
   * Optional subjective reliability rating (1-5), entered by the user.
   * Never inferred or fabricated by the app.
   */
  reliabilityRating: number | null;

  /** Where this quote came from. All MVP quotes are "manual"; parser-sourced
   * quotes would set the other values and record provenance. */
  source: QuoteSource;
}

export interface QuoteSource {
  method: "manual" | "csv" | "excel" | "pdf" | "email";
  /** For non-manual sources: when the source document was retrieved/parsed. */
  retrievedAt: string | null;
  /** For non-manual sources: link or filename the data came from. */
  reference: string | null;
}

export interface ScenarioAssumptions {
  /** The quantity the business actually needs to buy — drives all cost recalculation. */
  requiredQuantity: number;
  /** Annual cost of capital / discount rate, as a percentage (e.g. 12 = 12%/yr). */
  annualCostOfCapitalPercent: number;
  /** How many times per year this purchase recurs, used to annualize recurring/setup fees. */
  ordersPerYear: number;
  /** Lead times beyond this are treated as a risk flag. Null = no cap. */
  maxAcceptableLeadTimeDays: number | null;
}

export interface ScoringWeights {
  price: number;
  leadTime: number;
  paymentTerms: number;
  reliability: number;
  flexibility: number;
}

export const WEIGHT_KEYS: (keyof ScoringWeights)[] = [
  "price",
  "leadTime",
  "paymentTerms",
  "reliability",
  "flexibility",
];

export const DEFAULT_WEIGHTS: ScoringWeights = {
  price: 40,
  leadTime: 20,
  paymentTerms: 15,
  reliability: 15,
  flexibility: 10,
};

export const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  requiredQuantity: 1000,
  annualCostOfCapitalPercent: 10,
  ordersPerYear: 4,
  maxAcceptableLeadTimeDays: 30,
};

export function emptyPaymentTerms(): PaymentTerms {
  return { type: "net", netDays: 30, depositPercent: null, description: null };
}

export function emptyQuote(id: string): SupplierQuote {
  return {
    id,
    supplierName: "",
    productService: "",
    quantity: null,
    unitPrice: null,
    totalQuotedPrice: null,
    shippingCost: null,
    taxesFees: null,
    minimumOrderQuantity: null,
    volumeDiscounts: [],
    leadTimeDays: null,
    paymentTerms: emptyPaymentTerms(),
    quoteExpirationDate: null,
    contractLengthMonths: null,
    warranty: null,
    returnPolicy: null,
    cancellationTerms: null,
    setupFees: null,
    recurringFees: null,
    recurringFeePeriod: null,
    otherFees: null,
    otherFeesDescription: null,
    notes: null,
    supplierLocation: null,
    isIncumbent: false,
    qualitativeComments: null,
    reliabilityRating: null,
    source: { method: "manual", retrievedAt: null, reference: null },
  };
}
