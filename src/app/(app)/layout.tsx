import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/data/repository";
import { detectAuditFindings } from "@/lib/accounting/findings";
import { dataMode } from "@/lib/supabase/config";
import type { Permission } from "@/lib/auth/permission-catalog";
import { resolveCompanyPermission } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const repo = getRepository();
  const companies = await repo.listCompanies(user.id);

  const alertsByCompany: Record<string, number> = {};
  const permissionsByCompany: Record<string, Permission[]> = {};
  for (const company of companies) {
    const state = await resolveCompanyPermission(user, company.id);
    permissionsByCompany[company.id] = state?.permissions ?? [];
  }
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
      <AppShell
        user={user}
        companies={companies}
        alertsByCompany={alertsByCompany}
        permissionsByCompany={permissionsByCompany}
        mode={dataMode()}
      >
        {children}
      </AppShell>
    </Suspense>
  );
}
