"use client";

import { FileSpreadsheet, Plus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/store/app-context";

export function AppHeader({ onAddQuote, onUploadQuote }: { onAddQuote: () => void; onUploadQuote: () => void }) {
  const { state, loadDemo, clearAll } = useAppState();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight tracking-tight">Supplier Quote Comparison</h1>
            <p className="text-xs leading-tight text-muted-foreground">Compare the total economic deal, not the sticker price</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!state.isDemo && (
            <>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => loadDemo()}>
                Load demo
              </Button>
              {state.quotes.length > 0 && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => clearAll()}>
                  Clear all
                </Button>
              )}
            </>
          )}
          <Button variant="outline" size="sm" onClick={onUploadQuote}>
            <Upload className="h-3.5 w-3.5" /> Upload quote
          </Button>
          <Button size="sm" onClick={onAddQuote}>
            <Plus className="h-3.5 w-3.5" /> Add quote
          </Button>
        </div>
      </div>
      {state.isDemo && (
        <div className="border-t border-border bg-muted/60">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-xs text-muted-foreground sm:px-6">
            <Badge variant="outline">Demo data</Badge>
            <span>These supplier quotes are fictional and provided only to demonstrate the application.</span>
            <span className="ml-auto flex gap-3">
              <button type="button" onClick={() => loadDemo()} className="font-medium text-foreground hover:underline">
                Reset demo
              </button>
              <button type="button" onClick={() => clearAll()} className="font-medium text-foreground hover:underline">
                Start from scratch
              </button>
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
