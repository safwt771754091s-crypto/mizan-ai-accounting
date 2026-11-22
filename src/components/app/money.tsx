import { currencySymbol, formatNumber, round2 } from "@/lib/accounting/money";
import { cn } from "@/lib/utils/cn";

export function Money({
  value,
  currency = "SAR",
  className,
  colored = false,
  compact = false,
  showCurrency = true,
}: {
  value: number | string | null | undefined;
  currency?: string;
  className?: string;
  colored?: boolean;
  compact?: boolean;
  showCurrency?: boolean;
}) {
  const numeric = Number(value ?? 0);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const digits = compact && Math.abs(safe) >= 1000 ? 0 : 2;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    notation: compact && Math.abs(safe) >= 1_000_000 ? "compact" : "standard",
  }).format(round2(safe).toNumber());

  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        dir="ltr"
        className={cn(
          "num tabular-nums",
          colored && safe < 0 && "text-danger-600",
          colored && safe > 0 && "text-success-600",
        )}
      >
        {formatted}
      </span>
      {showCurrency ? <span className="text-[0.72em] font-medium text-muted">{currencySymbol(currency)}</span> : null}
    </span>
  );
}

export function NumberText({ value, digits = 0, className }: { value: number; digits?: number; className?: string }) {
  return (
    <span dir="ltr" className={cn("num tabular-nums", className)}>
      {formatNumber(value, digits)}
    </span>
  );
}

export function PercentText({ value, className }: { value: number | null; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted">—</span>;
  return (
    <span dir="ltr" className={cn("num tabular-nums", className)}>
      {value.toFixed(1)}%
    </span>
  );
}
