import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import type { Severity } from "@/lib/accounting/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        default: "border-brand-200 bg-brand-50 text-brand-800",
        teal: "border-teal-200 bg-teal-50 text-teal-800",
        neutral: "border-line bg-surface text-muted",
        success: "border-success-100 bg-success-50 text-success-600",
        warning: "border-warning-100 bg-warning-50 text-warning-600",
        danger: "border-danger-100 bg-danger-50 text-danger-600",
        info: "border-info-100 bg-info-50 text-info-500",
        outline: "border-line bg-white text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "حرج",
  high: "مرتفع",
  medium: "متوسط",
  low: "منخفض",
  info: "معلومة",
};

const SEVERITY_VARIANTS: Record<Severity, BadgeProps["variant"]> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
  info: "neutral",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge variant={SEVERITY_VARIANTS[severity]} className={className}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          severity === "critical" && "bg-danger-500",
          severity === "high" && "bg-warning-500",
          severity === "medium" && "bg-info-500",
          (severity === "low" || severity === "info") && "bg-muted",
        )}
      />
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export function StrengthBadge({ strength }: { strength: "strong" | "medium" | "weak" }) {
  const map = {
    strong: { label: "اشتباه قوي", variant: "danger" as const },
    medium: { label: "اشتباه متوسط", variant: "warning" as const },
    weak: { label: "اشتباه ضعيف", variant: "neutral" as const },
  };
  return <Badge variant={map[strength].variant}>{map[strength].label}</Badge>;
}
