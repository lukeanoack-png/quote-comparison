"use client";

import { Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CSV_TEMPLATE, parseQuotesCsv, type ImportResult } from "@/lib/import/csv";
import { useAppState } from "@/lib/store/app-context";

export function UploadQuoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addQuote } = useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFileName(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(parseQuotesCsv(await file.text(), file.name));
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "supplier-quote-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importQuotes() {
    result?.quotes.forEach((q) => addQuote(q));
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload quotes</DialogTitle>
          <DialogDescription>
            Import one or more quotes from a CSV file, one quote per row. Blank cells are treated as not provided and flagged — never assumed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center transition-colors hover:border-primary"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
          >
            <FileUp className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName ?? "Choose a CSV file or drop it here"}</span>
            <span className="text-xs text-muted-foreground">.csv, using the template&apos;s column names</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>

          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <Download className="h-3.5 w-3.5" /> Download CSV template
          </button>

          {result && (
            <div className="space-y-2 rounded-md bg-muted/60 px-4 py-3 text-sm">
              <p className="font-medium">
                {result.quotes.length} {result.quotes.length === 1 ? "quote" : "quotes"} ready to import
                {result.quotes.length > 0 && (
                  <span className="font-normal text-muted-foreground">: {result.quotes.map((q) => q.supplierName).join(", ")}</span>
                )}
              </p>
              {result.errors.length > 0 && (
                <ul className="space-y-1 text-xs text-warning">
                  {result.errors.slice(0, 6).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {result.errors.length > 6 && <li>…and {result.errors.length - 6} more.</li>}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">PDF and Excel extraction isn&apos;t available yet — export those to CSV, or use Add quote.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={importQuotes} disabled={!result || result.quotes.length === 0}>
            Import {result && result.quotes.length > 0 ? result.quotes.length : ""} {result?.quotes.length === 1 ? "quote" : "quotes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
