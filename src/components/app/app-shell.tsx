"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Bot,
  CalendarRange,
  ClipboardCheck,
  History,
  Lightbulb,
  Building2,
  ChevronDown,
  Copy,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Scale,
  Settings,
  ShieldAlert,
  Table2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MEMBER_ROLE_LABELS } from "@/lib/data/types";
import type { Permission } from "@/lib/auth/permission-catalog";
import type { CompanyWithAccess, MemberRole } from "@/lib/data/types";
import type { AppUser } from "@/lib/data/types";
import { signOutAction } from "@/app/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  /** عند غياب الصلاحية لا يظهر الرابط إطلاقاً (إخفاء الواجهة لا يُغني عن تحقق الخادم). */
  permission?: Permission;
}

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "الرئيسية",
    items: [{ href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard }],
  },
  {
    title: "المحاسبة",
    items: [
      { href: "/companies", label: "الشركات", icon: Building2 },
      { href: "/upload", label: "رفع الملفات", icon: Upload, permission: "imports.create" },
      { href: "/imports", label: "بيانات المحاسبة المستوردة", icon: FileSpreadsheet, permission: "imports.read" },
      { href: "/accounts", label: "دليل الحسابات", icon: BookOpen, permission: "accounts.read" },
      { href: "/trial-balance", label: "ميزان المراجعة", icon: Table2, permission: "reports.view" },
      { href: "/ledger", label: "دفتر الأستاذ", icon: Receipt, permission: "journal.read" },
      { href: "/approvals", label: "مسارات الاعتماد", icon: ClipboardCheck, permission: "journal.read" },
      { href: "/periods", label: "الفترات المالية", icon: CalendarRange, permission: "periods.read" },
    ],
  },
  {
    title: "التقارير والتحليل",
    items: [
      { href: "/statements", label: "القوائم المالية", icon: FileText, permission: "reports.view" },
      { href: "/analysis", label: "التحليل المالي", icon: TrendingUp, permission: "reports.view" },
      { href: "/reports", label: "التقارير", icon: Wallet, permission: "reports.view" },
    ],
  },
  {
    title: "المراجعة الذكية",
    items: [
      { href: "/findings", label: "اكتشاف الأخطاء", icon: ShieldAlert, permission: "findings.view" },
      { href: "/anomalies", label: "العمليات غير المعتادة", icon: ShieldAlert, permission: "findings.view" },
      { href: "/duplicates", label: "القيود المكررة", icon: Copy, permission: "findings.view" },
    ],
  },
  {
    title: "النظام",
    items: [
      { href: "/assistant", label: "المساعد الذكي", icon: Bot, permission: "reports.view" },
      { href: "/settings", label: "الإعدادات", icon: Settings, permission: "company.read" },
      { href: "/users", label: "المستخدمون والصلاحيات", icon: Users, permission: "company.members.read" },
      { href: "/audit", label: "سجل التدقيق", icon: History, permission: "audit.view" },
      { href: "/proposals", label: "مركز المقترحات", icon: Lightbulb, permission: "proposals.view" },
    ],
  },
];

export function AppShell({
  user,
  companies,
  alertsByCompany,
  permissionsByCompany,
  mode,
  children,
}: {
  user: AppUser;
  companies: CompanyWithAccess[];
  alertsByCompany: Record<string, number>;
  permissionsByCompany: Record<string, Permission[]>;
  mode: "demo" | "supabase";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const selectedId = searchParams.get("company") ?? companies[0]?.id ?? null;
  const current = companies.find((c) => c.id === selectedId) ?? companies[0] ?? null;
  const currentCompanyId = current?.id ?? null;
  const role: MemberRole | null = current?.role ?? null;
  const alerts = currentCompanyId ? (alertsByCompany[currentCompanyId] ?? 0) : 0;
  const permissions = currentCompanyId ? (permissionsByCompany[currentCompanyId] ?? []) : [];
  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);

  const withCompany = (href: string) =>
    currentCompanyId ? `${href}${href.includes("?") ? "&" : "?"}company=${currentCompanyId}` : href;

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/30">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-bold text-white">ركاز</p>
          <p className="text-[10px] tracking-widest text-teal-200/80">RAKAZ AI</p>
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
        <label className="mb-1 block text-[10px] font-semibold text-white/60">الشركة الحالية</label>
        <div className="relative">
          <select
            aria-label="اختيار الشركة"
            className="w-full appearance-none rounded-lg border border-white/10 bg-brand-950/40 py-2 pe-7 ps-2 text-xs font-semibold text-white focus:outline-none"
            value={currentCompanyId ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              router.push(`${pathname}?company=${next}`);
              setOpen(false);
            }}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id} className="text-ink">
                {company.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute inset-y-0 end-2 my-auto h-4 w-4 text-white/60" />
        </div>
        {role ? <p className="mt-1.5 text-[10px] text-white/50">دورك: {MEMBER_ROLE_LABELS[role]}</p> : null}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-white/55">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={withCompany(item.href)}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-teal-300" : "text-white/60 group-hover:text-teal-200")} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/findings" && alerts > 0 ? (
                        <span className="rounded-full bg-danger-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {alerts}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/5 p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-100">
            {user.fullName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user.fullName}</p>
            <p className="truncate text-[10px] text-white/45">{user.email}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[276px_1fr]">
      <aside className="brand-gradient sticky top-0 hidden h-screen lg:block">{nav}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="brand-gradient absolute inset-y-0 end-0 w-72 shadow-float">
            <button
              type="button"
              aria-label="إغلاق القائمة"
              className="absolute start-3 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/85 px-4 backdrop-blur lg:px-8 no-print">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="فتح القائمة"
              className="rounded-lg border border-line p-2 text-ink lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{current?.name ?? "RAKAZ AI"}</p>
              <p className="truncate text-[10px] text-muted">
                {current ? `${current.activityType} · ${current.currency}` : "ركاز — منصة الذكاء المحاسبي والمالي"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "demo" ? (
              <span className="hidden rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-[10px] font-bold text-warning-600 sm:inline-flex">
                وضع تجريبي — بيانات وهمية
              </span>
            ) : (
              <span className="hidden rounded-full border border-success-100 bg-success-50 px-2.5 py-1 text-[10px] font-bold text-success-600 sm:inline-flex">
                Supabase متصل
              </span>
            )}
            <Link
              href={withCompany("/upload")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
            >
              <Upload className="h-3.5 w-3.5" />
              رفع ملف
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="border-t border-line px-4 py-4 text-center text-[10px] leading-relaxed text-muted lg:px-8 no-print">
          RAKAZ AI — منصة تحليل محاسبي مساعدة. النتائج والتقارير لا تُعد رأياً قانونياً أو تقرير مراجعة معتمداً.
        </footer>
      </div>
    </div>
  );
}
