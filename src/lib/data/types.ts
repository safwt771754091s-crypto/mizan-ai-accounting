import type { Account, AccountingPeriod, JournalEntry } from "@/lib/accounting/types";
import type { ImportBatchRecord, NormalizedRow } from "@/lib/import/types";

export type MemberRole = "owner" | "admin" | "accountant" | "auditor" | "viewer";

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: "مالك",
  admin: "مدير",
  accountant: "محاسب",
  auditor: "مراجع",
  viewer: "مشاهد",
};

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  active: "نشطة",
  inactive: "غير نشطة",
  archived: "مؤرشفة",
};

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  legalName: string;
  activityType: string;
  country: string;
  currency: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  entityType: string;
  status: "active" | "inactive" | "archived";
  taxNumber?: string | null;
  registrationNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
}

export interface ImportedRecord {
  id: string;
  companyId: string;
  batchId: string;
  dataset: string;
  rowNumber: number;
  data: Record<string, string>;
  createdAt: string;
}

export interface FindingState {
  findingId: string;
  companyId: string;
  status: "open" | "reviewed" | "dismissed";
  note?: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface ActivityLog {
  id: string;
  companyId: string | null;
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface CompanyData {
  accounts: Account[];
  entries: JournalEntry[];
  periods: AccountingPeriod[];
  batches: ImportBatchRecord[];
  records: ImportedRecord[];
  findingStates: FindingState[];
  logs: ActivityLog[];
}

export interface CompanyWithAccess extends Company {
  role: MemberRole;
  memberCount: number;
  entryCount: number;
}

export interface DemoStore {
  version: number;
  users: Array<AppUser & { passwordHash: string }>;
  companies: Company[];
  members: CompanyMember[];
  data: Record<string, CompanyData>;
  activity: ActivityLog[];
}

export interface ImportSaveInput {
  batch: Omit<ImportBatchRecord, "id" | "createdAt" | "createdBy" | "companyId">;
  accounts: Array<{ code: string; name: string; debit: number; credit: number; subtype?: string; accountType?: string }>;
  entries: Array<{
    entryNumber: string;
    date: string;
    description: string;
    reference?: string;
    lines: Array<{
      accountCode: string;
      debit: number;
      credit: number;
      description?: string;
      costCenter?: string;
      branch?: string;
    }>;
  }>;
  records: NormalizedRow[];
}

export function canWrite(role: MemberRole): boolean {
  return role === "owner" || role === "admin" || role === "accountant";
}

export function canManageUsers(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export function canReview(role: MemberRole): boolean {
  return role !== "viewer";
}
