import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { AlertTriangle, CheckCircle2, Info, CircleAlert, Inbox } from "lucide-react";

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-info-100 bg-info-50 text-info-500",
    warning: "border-warning-100 bg-warning-50 text-warning-600",
    danger: "border-danger-100 bg-danger-50 text-danger-600",
    success: "border-success-100 bg-success-50 text-success-600",
  } as const;
  const Icon = variant === "danger" ? CircleAlert : variant === "warning" ? AlertTriangle : variant === "success" ? CheckCircle2 : Info;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", styles[variant], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="mb-0.5 font-bold">{title}</p> : null}
        <div className="text-ink/80">{children}</div>
      </div>
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className="h-full rounded-full bg-teal-500 transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-teal-700">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: { value: number | null; label?: string };
  tone?: "default" | "success" | "danger" | "warning";
  icon?: React.ReactNode;
}) {
  const toneClass = {
    default: "text-brand-900",
    success: "text-success-600",
    danger: "text-danger-600",
    warning: "text-warning-600",
  }[tone];
  return (
    <div className="rounded-2xl border border-line bg-white p-5 card-shadow">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {icon ? <span className="rounded-xl bg-surface p-2 text-teal-700">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-xl font-bold tabular-nums", toneClass)}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
        {trend && trend.value !== null ? (
          <span
            className={cn(
              "font-semibold",
              trend.value >= 0 ? "text-success-600" : "text-danger-600",
            )}
          >
            {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-teal-700">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold text-brand-950">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-bold text-ink">{children}</h2>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}
