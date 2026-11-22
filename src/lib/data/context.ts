import type { Ledger } from "@/lib/accounting/types";
import { requireUser } from "@/lib/auth";
import { getRepository, type Repository } from "./repository";
import type { AppUser, CompanyData, CompanyWithAccess, MemberRole } from "./types";

export interface CompanyContext {
  user: AppUser;
  repo: Repository;
  companies: CompanyWithAccess[];
  company: CompanyWithAccess | null;
  data: CompanyData;
  ledger: Ledger;
  role: MemberRole | null;
  currency: string;
  period: { from: string; to: string };
}

const EMPTY_DATA: CompanyData = {
  accounts: [],
  entries: [],
  periods: [],
  batches: [],
  records: [],
  findingStates: [],
  logs: [],
};

export function defaultPeriod(company: { fiscalYearStart: string; fiscalYearEnd: string }): {
  from: string;
  to: string;
} {
  const today = new Date().toISOString().slice(0, 10);
  const to = company.fiscalYearEnd && company.fiscalYearEnd < today ? company.fiscalYearEnd : today;
  return { from: company.fiscalYearStart, to };
}

export async function loadCompanyContext(companyId?: string): Promise<CompanyContext> {
  const user = await requireUser();
  const repo = getRepository();
  const companies = await repo.listCompanies(user.id);

  if (!companies.length) {
    return {
      user,
      repo,
      companies,
      company: null,
      data: EMPTY_DATA,
      ledger: { accounts: [], entries: [], currency: "SAR" },
      role: null,
      currency: "SAR",
      period: { from: `${new Date().getFullYear()}-01-01`, to: new Date().toISOString().slice(0, 10) },
    };
  }

  const company = companies.find((c) => c.id === companyId) ?? companies[0];
  const data = await repo.getCompanyData(company.id);
  const ledger: Ledger = {
    accounts: data.accounts,
    entries: data.entries,
    periods: data.periods,
    currency: company.currency,
  };

  return {
    user,
    repo,
    companies,
    company,
    data,
    ledger,
    role: company.role,
    currency: company.currency,
    period: defaultPeriod(company),
  };
}

export function resolvePeriod(
  searchParams: { from?: string; to?: string } | undefined,
  fallback: { from: string; to: string },
): { from: string; to: string } {
  const from = searchParams?.from && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from) ? searchParams.from : fallback.from;
  const to = searchParams?.to && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to) ? searchParams.to : fallback.to;
  if (from > to) return { from: to, to: from };
  return { from, to };
}
