import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/data/repository";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { dataMode } from "@/lib/supabase/config";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const repo = getRepository();
  const companies = await repo.listCompanies(user.id);

  const alertsByCompany: Record<string, number> = {};
  for (const company of companies.slice(0, 5)) {
    const data = await repo.getCompanyData(company.id);
    const findings = detectAuditFindings(
      { accounts: data.accounts, entries: data.entries, periods: data.periods, currency: company.currency },
      { from: company.fiscalYearStart, to: company.fiscalYearEnd },
    );
    alertsByCompany[company.id] = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <AppShell user={user} companies={companies} alertsByCompany={alertsByCompany} mode={dataMode()}>
        {children}
      </AppShell>
    </Suspense>
  );
}
