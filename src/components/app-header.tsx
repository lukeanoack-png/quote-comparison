"use client";

import { FileSpreadsheet, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/store/app-context";

export function AppHeader() {
  const { state, loadDemo, clearAll } = useAppState();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight tracking-tight">Supplier Quote Comparison</h1>
            <p className="text-xs leading-tight text-muted-foreground">Compare the total economic deal, not just the sticker price</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => clearAll()}>
            Clear all
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadDemo()}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reload demo data
          </Button>
        </div>
      </div>
      {state.isDemo && (
        <div className="border-t border-border bg-muted/60">
          <div className="mx-auto flex max-w-[1400px] items-start gap-2 px-4 py-2 text-xs text-muted-foreground sm:items-center sm:px-6">
            <Badge variant="warning">Demo data</Badge>
            These supplier quotes are fictional and are provided only to demonstrate the application.
          </div>
        </div>
      )}
    </header>
  );
}
