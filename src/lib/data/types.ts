import type { Account, AccountingPeriod, JournalEntry } from "@/lib/accounting/types";
import type { CompanyRole, Permission } from "@/lib/auth/permission-catalog";
import { ROLE_LABELS } from "@/lib/auth/permission-catalog";
import type { ImportBatchRecord, NormalizedRow } from "@/lib/import/types";

export type MemberRole = CompanyRole;

export const MEMBER_ROLE_LABELS = ROLE_LABELS;

/** دور مخصص داخل شركة؛ صلاحياته تستبدل صلاحيات الدور النظامي. */
export interface CustomRole {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  permissions: Permission[];
  createdAt: string;
  createdBy: string;
}

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

/** سطر تدقيق غير قابل للتعديل: من فعل ماذا ومتى وعلى أي كيان. */
export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  meta?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  role: MemberRole;
  customRoleId?: string | null;
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

export type ProposalCategory = "workflow" | "report" | "import" | "ux" | "other";
export type ProposalPriority = "low" | "medium" | "high";
export type ProposalStatus = "new" | "under_review" | "accepted" | "rejected" | "shipped";

/** مقترح تطوير مقدَّم من عضو شركة، ويمكن تحويله إلى Issue على GitHub. */
export interface Proposal {
  id: string;
  companyId: string;
  title: string;
  body: string;
  category: ProposalCategory;
  priority: ProposalPriority;
  status: ProposalStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  decisionNote: string | null;
  issueNumber: number | null;
  issueUrl: string | null;
}

export interface DemoStore {
  version: number;
  users: Array<AppUser & { passwordHash: string }>;
  companies: Company[];
  members: CompanyMember[];
  roles: CustomRole[];
  audit: AuditLog[];
  proposals: Proposal[];
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
  return role === "owner" || role === "admin" || role === "senior_accountant" || role === "accountant";
}

export function canManageUsers(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export function canReview(role: MemberRole): boolean {
  return role !== "viewer";
}
