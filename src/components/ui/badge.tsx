import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

// default = accent (the recommendation), success = favorable economics,
// warning = incomplete information, destructive = material risk.

const variantClasses: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-transparent",
  secondary: "bg-secondary text-secondary-foreground border-transparent",
  success: "bg-success/10 text-success border-transparent",
  warning: "bg-warning/10 text-warning border-transparent",
  destructive: "bg-destructive/10 text-destructive border-transparent",
  outline: "border-border text-muted-foreground",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-[3px] text-2xs font-medium leading-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
