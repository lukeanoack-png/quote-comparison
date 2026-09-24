import { emptyQuote, type SupplierQuote } from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * CSV import: one quote per row, using the template columns below.
 * Blank cells stay null ("not provided") — exactly like manual entry —
 * so missing data is flagged rather than assumed.
 */

type ColumnType = "text" | "number" | "date" | "bool";

const COLUMNS: { key: string; type: ColumnType; apply: (q: SupplierQuote, v: string | number | boolean | null) => void }[] = [
  { key: "supplier_name", type: "text", apply: (q, v) => (q.supplierName = (v as string) ?? "") },
  { key: "product", type: "text", apply: (q, v) => (q.productService = (v as string) ?? "") },
  { key: "location", type: "text", apply: (q, v) => (q.supplierLocation = v as string | null) },
  { key: "quantity", type: "number", apply: (q, v) => (q.quantity = v as number | null) },
  { key: "unit_price", type: "number", apply: (q, v) => (q.unitPrice = v as number | null) },
  { key: "total_quoted_price", type: "number", apply: (q, v) => (q.totalQuotedPrice = v as number | null) },
  { key: "shipping_cost", type: "number", apply: (q, v) => (q.shippingCost = v as number | null) },
  { key: "taxes_fees", type: "number", apply: (q, v) => (q.taxesFees = v as number | null) },
  { key: "setup_fee", type: "number", apply: (q, v) => (q.setupFees = v as number | null) },
  { key: "other_fees", type: "number", apply: (q, v) => (q.otherFees = v as number | null) },
  { key: "minimum_order_quantity", type: "number", apply: (q, v) => (q.minimumOrderQuantity = v as number | null) },
  { key: "lead_time_days", type: "number", apply: (q, v) => (q.leadTimeDays = v as number | null) },
  {
    key: "payment_net_days",
    type: "number",
    apply: (q, v) => (q.paymentTerms = { type: v === 0 ? "immediate" : "net", netDays: v as number | null, depositPercent: null, description: null }),
  },
  { key: "quote_expiration_date", type: "date", apply: (q, v) => (q.quoteExpirationDate = v as string | null) },
  { key: "contract_length_months", type: "number", apply: (q, v) => (q.contractLengthMonths = v as number | null) },
  { key: "warranty", type: "text", apply: (q, v) => (q.warranty = v as string | null) },
  { key: "return_policy", type: "text", apply: (q, v) => (q.returnPolicy = v as string | null) },
  { key: "cancellation_terms", type: "text", apply: (q, v) => (q.cancellationTerms = v as string | null) },
  { key: "reliability_rating", type: "number", apply: (q, v) => (q.reliabilityRating = v as number | null) },
  { key: "incumbent", type: "bool", apply: (q, v) => (q.isIncumbent = v === true) },
  { key: "notes", type: "text", apply: (q, v) => (q.notes = v as string | null) },
];

export const CSV_TEMPLATE =
  COLUMNS.map((c) => c.key).join(",") +
  "\n" +
  'Example Supply Co,Steel bracket SB-200,"Columbus, OH",1000,18.50,,450,,0,0,250,21,30,2026-12-31,,1-year warranty,,,4,no,\n';

export interface ImportResult {
  quotes: SupplierQuote[];
  errors: string[];
}

export function parseQuotesCsv(text: string, fileName: string): ImportResult {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return { quotes: [], errors: ["The file has no data rows. Use the template's header row and add one quote per row."] };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const errors: string[] = [];
  if (!header.includes("supplier_name")) return { quotes: [], errors: ['Missing required "supplier_name" column.'] };
  const unknown = header.filter((h) => h && !COLUMNS.some((c) => c.key === h));
  if (unknown.length > 0) errors.push(`Ignored unrecognized column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);

  const quotes: SupplierQuote[] = [];
  rows.slice(1).forEach((row, r) => {
    const line = r + 2;
    const q = emptyQuote(uid("supplier"));
    q.source = { method: "csv", retrievedAt: new Date().toISOString(), reference: fileName };
    // The manual form pre-fills Net 30 visibly; an import must not assume it silently.
    q.paymentTerms = { type: "net", netDays: null, depositPercent: null, description: null };
    let rowOk = true;

    header.forEach((h, i) => {
      const col = COLUMNS.find((c) => c.key === h);
      if (!col) return;
      const raw = (row[i] ?? "").trim();
      if (raw === "") return col.apply(q, col.type === "bool" ? false : null);
      if (col.type === "number") {
        const n = Number(raw.replace(/[$,%\s]/g, ""));
        if (Number.isNaN(n) || n < 0) {
          errors.push(`Row ${line}: "${raw}" in ${h} is not a valid non-negative number.`);
          rowOk = false;
          return;
        }
        if (h === "reliability_rating" && (n < 1 || n > 5)) {
          errors.push(`Row ${line}: reliability_rating must be 1–5.`);
          rowOk = false;
          return;
        }
        col.apply(q, n);
      } else if (col.type === "date") {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          errors.push(`Row ${line}: "${raw}" in ${h} is not a valid date (use YYYY-MM-DD).`);
          rowOk = false;
          return;
        }
        col.apply(q, d.toISOString().slice(0, 10));
      } else if (col.type === "bool") {
        col.apply(q, /^(y|yes|true|1)$/i.test(raw));
      } else {
        col.apply(q, raw);
      }
    });

    if (!q.supplierName.trim()) {
      errors.push(`Row ${line}: supplier_name is required.`);
      rowOk = false;
    }
    if (rowOk) quotes.push(q);
  });

  return { quotes, errors };
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
