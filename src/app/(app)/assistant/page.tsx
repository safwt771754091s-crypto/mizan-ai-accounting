import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { isAiConfigured } from "@/lib/supabase/config";
import { AssistantChat } from "@/components/app/assistant-chat";
import { NoCompanyState } from "@/components/app/blocks";
import { Money } from "@/components/app/money";
import { buildIncomeStatement } from "@/lib/accounting/statements";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "المساعد الذكي" };

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="المساعد الذكي" />
        <NoCompanyState />
      </>
    );
  }

  const income = buildIncomeStatement(ctx.ledger, ctx.period);
  const findings = detectAuditFindings(ctx.ledger, ctx.period);

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="المساعد المحاسبي الذكي"
        description="اسأل عن أرقام شركتك وتحليلها. تُبنى الإجابات من محرك الحسابات على الخادم، مع ذكر المصادر ومنع الوصول لبيانات أي شركة أخرى."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-semibold text-muted">
            <Bot className="h-3.5 w-3.5 text-teal-700" />
            {isAiConfigured() ? "مزود AI متصل" : "وضع الحساب المحلي"}
          </span>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">صافي الربح</p>
          <p className="mt-1 text-lg font-bold text-brand-900"><Money value={income.netProfit} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">صافي الإيرادات</p>
          <p className="mt-1 text-lg font-bold text-brand-900"><Money value={income.netRevenue} currency={ctx.currency} /></p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[11px] text-muted">ملاحظات الفحص</p>
          <p className="mt-1 text-lg font-bold text-brand-900" dir="ltr">{findings.length}</p>
        </div>
      </div>

      <AssistantChat
        companyId={ctx.company.id}
        companyName={ctx.company.name}
        currency={ctx.currency}
        aiConfigured={isAiConfigured()}
      />
    </>
  );
}
