"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  placeholder?: string;
  tooltip?: string;
  error?: string | null;
}

export function NumberField({ label, value, onChange, prefix, suffix, min = 0, placeholder, tooltip, error }: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </Label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          min={min}
          value={value ?? ""}
          placeholder={placeholder ?? "Not specified"}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const parsed = Number(raw);
            onChange(Number.isNaN(parsed) ? null : parsed);
          }}
          className={cn(prefix && "pl-6", suffix && "pr-10", error && "border-destructive")}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {error && <p className="text-2xs text-destructive">{error}</p>}
    </div>
  );
}
