import type { Ledger } from "@/lib/accounting/types";
import type { Permission } from "@/lib/auth/permission-catalog";
import type { ImportBatchRecord } from "@/lib/import/types";
import { dataMode } from "../supabase/config";
import { buildChart } from "./demo-data";
import { mutateStore, readStore } from "./store";
import { canWrite } from "./types";
import type {
  ActivityLog,
  AppUser,
  Company,
  CompanyData,
  CompanyMember,
  CompanyWithAccess,
  CustomRole,
  FindingState,
  ImportSaveInput,
  MemberRole,
} from "./types";
import { createSupabaseRepository } from "./supabase-repository";

export interface CompanyAccess {
  company: Company;
  role: MemberRole;
}

export interface Repository {
  readonly mode: "demo" | "supabase";
  listCompanies(userId: string): Promise<CompanyWithAccess[]>;
  getCompanyAccess(userId: string, companyId: string): Promise<CompanyAccess | null>;
  createCompany(userId: string, input: Partial<Company> & { name: string }): Promise<Company>;
  updateCompany(userId: string, companyId: string, patch: Partial<Company>): Promise<Company | null>;
  getCompanyData(companyId: string): Promise<CompanyData>;
  getLedger(companyId: string): Promise<Ledger>;
  saveImport(
    companyId: string,
    userId: string,
    input: ImportSaveInput,
  ): Promise<{ batch: ImportBatchRecord; skipped: number; duplicate: boolean }>;
  setFindingStatus(
    companyId: string,
    userId: string,
    findingId: string,
    status: FindingState["status"],
    note?: string,
  ): Promise<void>;
  listMembers(companyId: string): Promise<Array<CompanyMember & { user: AppUser }>>;
  /** الأدوار المخصصة داخل الشركة (لا تشمل أدوار النظام). */
  listCustomRoles(companyId: string): Promise<CustomRole[]>;
  createCustomRole(
    companyId: string,
    userId: string,
    input: { name: string; description?: string | null; permissions: Permission[] },
  ): Promise<{ ok: boolean; role?: CustomRole; error?: string }>;
  updateCustomRole(
    companyId: string,
    roleId: string,
    patch: { name?: string; description?: string | null; permissions?: Permission[] },
  ): Promise<{ ok: boolean; error?: string }>;
  deleteCustomRole(companyId: string, roleId: string): Promise<{ ok: boolean; error?: string }>;
  /** الدور المخصص المعيّن للعضو، أو null إن كان يستخدم دوره النظامي. */
  getMemberCustomRole(userId: string, companyId: string): Promise<CustomRole | null>;
  setMemberCustomRole(companyId: string, memberId: string, roleId: string | null): Promise<{ ok: boolean; error?: string }>;
  inviteMember(companyId: string, email: string, role: MemberRole): Promise<{ ok: boolean; error?: string }>;
  updateMemberRole(companyId: string, memberId: string, role: MemberRole): Promise<void>;
  removeMember(companyId: string, memberId: string): Promise<void>;
  listUsers(): Promise<AppUser[]>;
  listActivity(companyId: string, limit?: number): Promise<ActivityLog[]>;
  log(
    companyId: string | null,
    userId: string,
    action: string,
    entity: string,
    entityId?: string,
    meta?: Record<string, string | number | boolean | null>,
  ): Promise<void>;
}

function emptyCompanyData(companyId: string, fiscalYearStart: string): CompanyData {
  const year = fiscalYearStart.slice(0, 4);
  return {
    accounts: buildChart(companyId),
    entries: [],
    periods: [
      {
        id: `period-${companyId}-${year}`,
        companyId,
        name: `السنة المالية ${year}`,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        status: "open",
      },
    ],
    batches: [],
    records: [],
    findingStates: [],
    logs: [],
  };
}

class DemoRepository implements Repository {
  readonly mode = "demo" as const;

  async listCompanies(userId: string): Promise<CompanyWithAccess[]> {
    const store = await readStore();
    const memberships = store.members.filter((m) => m.userId === userId);
    return memberships
      .map((membership) => {
        const company = store.companies.find((c) => c.id === membership.companyId);
        if (!company) return null;
        const data = store.data[company.id];
        return {
          ...company,
          role: membership.role,
          memberCount: store.members.filter((m) => m.companyId === company.id).length,
          entryCount: data?.entries.length ?? 0,
        } satisfies CompanyWithAccess;
      })
      .filter((value): value is CompanyWithAccess => value !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  async getCompanyAccess(userId: string, companyId: string): Promise<CompanyAccess | null> {
    const store = await readStore();
    const membership = store.members.find((m) => m.companyId === companyId && m.userId === userId);
    if (!membership) return null;
    const company = store.companies.find((c) => c.id === companyId);
    if (!company) return null;
    return { company, role: membership.role };
  }

  async createCompany(userId: string, input: Partial<Company> & { name: string }): Promise<Company> {
    const now = new Date().toISOString();
    const id = `co-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const fiscalYearStart = input.fiscalYearStart ?? `${new Date().getFullYear()}-01-01`;
    const company: Company = {
      id,
      name: input.name.trim(),
      legalName: input.legalName?.trim() || input.name.trim(),
      activityType: input.activityType?.trim() || "غير محدد",
      country: input.country?.trim() || "SA",
      currency: input.currency?.trim() || "SAR",
      fiscalYearStart,
      fiscalYearEnd: input.fiscalYearEnd ?? `${fiscalYearStart.slice(0, 4)}-12-31`,
      entityType: input.entityType?.trim() || "شركة",
      status: "active",
      taxNumber: input.taxNumber ?? null,
      registrationNumber: input.registrationNumber ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      createdBy: userId,
    };
    await mutateStore((store) => {
      store.companies.push(company);
      store.members.push({
        id: `mem-${Date.now().toString(36)}`,
        companyId: id,
        userId,
        role: "owner",
        createdAt: now,
      });
      store.data[id] = emptyCompanyData(id, fiscalYearStart);
      store.activity.unshift({
        id: `log-${Date.now().toString(36)}`,
        companyId: id,
        userId,
        action: "create_company",
        entity: "company",
        entityId: id,
        meta: { name: company.name },
        createdAt: now,
      });
    });
    return company;
  }

  async updateCompany(userId: string, companyId: string, patch: Partial<Company>): Promise<Company | null> {
    const access = await this.getCompanyAccess(userId, companyId);
    if (!access || !canWrite(access.role)) return null;
    return mutateStore((store) => {
      const company = store.companies.find((c) => c.id === companyId);
      if (!company) return null;
      Object.assign(company, patch, { id: company.id, createdAt: company.createdAt, createdBy: company.createdBy });
      store.activity.unshift({
        id: `log-${Date.now().toString(36)}`,
        companyId,
        userId,
        action: "update_company",
        entity: "company",
        entityId: companyId,
        createdAt: new Date().toISOString(),
      });
      return company;
    });
  }

  async getCompanyData(companyId: string): Promise<CompanyData> {
    const store = await readStore();
    return (
      store.data[companyId] ?? {
        accounts: [],
        entries: [],
        periods: [],
        batches: [],
        records: [],
        findingStates: [],
        logs: [],
      }
    );
  }

  async getLedger(companyId: string): Promise<Ledger> {
    const store = await readStore();
    const company = store.companies.find((c) => c.id === companyId);
    const data = store.data[companyId];
    return {
      accounts: data?.accounts ?? [],
      entries: data?.entries ?? [],
      periods: data?.periods ?? [],
      currency: company?.currency ?? "SAR",
    };
  }

  async saveImport(companyId: string, userId: string, input: ImportSaveInput) {
    const access = await this.getCompanyAccess(userId, companyId);
    if (!access || !canWrite(access.role)) {
      throw new Error("لا تملك صلاحية استيراد البيانات لهذه الشركة.");
    }
    return mutateStore((store) => {
      const data = store.data[companyId];
      if (!data) throw new Error("بيانات الشركة غير موجودة.");
      const duplicate = data.batches.some(
        (batch) => batch.checksum === input.batch.checksum && batch.dataset === input.batch.dataset,
      );
      if (duplicate) {
        const existing = data.batches.find(
          (batch) => batch.checksum === input.batch.checksum && batch.dataset === input.batch.dataset,
        )!;
        return { batch: existing, skipped: 0, duplicate: true };
      }

      const now = new Date().toISOString();
      let skipped = 0;

      for (const draft of input.accounts) {
        const existing = data.accounts.find((a) => a.code === draft.code);
        const side = draft.debit >= draft.credit ? "debit" : "credit";
        const balance = Math.abs(draft.debit - draft.credit);
        if (existing) {
          existing.name = existing.name || draft.name;
          if (balance > 0) {
            existing.openingBalance = balance;
            existing.openingBalanceType = side;
          }
        } else {
          data.accounts.push({
            id: `acc-${companyId}-${draft.code}`,
            companyId,
            code: draft.code,
            name: draft.name,
            type: (draft.accountType as never) ?? "asset",
            subtype: (draft.subtype as never) ?? "other_asset",
            isActive: true,
            openingBalance: balance,
            openingBalanceType: side,
          });
        }
      }

      for (const draft of input.entries) {
        const exists = data.entries.some((entry) => entry.entryNumber === draft.entryNumber);
        if (exists) {
          skipped += 1;
          continue;
        }
        for (const line of draft.lines) {
          if (!data.accounts.some((a) => a.code === line.accountCode)) {
            data.accounts.push({
              id: `acc-${companyId}-${line.accountCode}`,
              companyId,
              code: line.accountCode,
              name: line.accountCode,
              type: "asset",
              subtype: "other_asset",
              isActive: true,
            });
          }
        }
        const entryId = `je-${companyId}-${draft.entryNumber}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 5)}`;
        data.entries.push({
          id: entryId,
          companyId,
          entryNumber: draft.entryNumber,
          date: draft.date,
          description: draft.description,
          reference: draft.reference ?? null,
          source: input.batch.dataset,
          status: "posted",
          currency: access.company.currency,
          lines: draft.lines.map((line, index) => ({
            id: `${entryId}-l${index}`,
            entryId,
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            description: line.description,
            costCenter: line.costCenter ?? null,
            branch: line.branch ?? null,
          })),
        });
      }

      const batch: ImportBatchRecord = {
        ...input.batch,
        id: `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        companyId,
        createdAt: now,
        createdBy: userId,
        skippedCount: input.batch.skippedCount + skipped,
      };
      data.batches.unshift(batch);

      for (const record of input.records) {
        data.records.push({
          id: `rec-${batch.id}-${record.rowNumber}`,
          companyId,
          batchId: batch.id,
          dataset: input.batch.dataset,
          rowNumber: record.rowNumber,
          data: record.values,
          createdAt: now,
        });
      }

      data.logs.unshift({
        id: `log-${Date.now().toString(36)}`,
        companyId,
        userId,
        action: "import_completed",
        entity: "import_batch",
        entityId: batch.id,
        meta: { rows: batch.rowCount, dataset: batch.dataset, fileName: batch.fileName },
        createdAt: now,
      });
      store.activity.unshift(data.logs[0]);

      return { batch, skipped, duplicate: false };
    });
  }

  async setFindingStatus(
    companyId: string,
    userId: string,
    findingId: string,
    status: FindingState["status"],
    note?: string,
  ): Promise<void> {
    const access = await this.getCompanyAccess(userId, companyId);
    if (!access || access.role === "viewer") throw new Error("لا تملك صلاحية مراجعة النتائج.");
    await mutateStore((store) => {
      const data = store.data[companyId];
      if (!data) return;
      const existing = data.findingStates.find((state) => state.findingId === findingId);
      if (existing) {
        existing.status = status;
        existing.note = note ?? existing.note;
        existing.updatedAt = new Date().toISOString();
        existing.updatedBy = userId;
      } else {
        data.findingStates.push({
          findingId,
          companyId,
          status,
          note: note ?? null,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        });
      }
    });
  }

  async listMembers(companyId: string): Promise<Array<CompanyMember & { user: AppUser }>> {
    const store = await readStore();
    return store.members
      .filter((member) => member.companyId === companyId)
      .map((member) => {
        const user = store.users.find((u) => u.id === member.userId);
        return {
          ...member,
          user: {
            id: member.userId,
            email: user?.email ?? "",
            fullName: user?.fullName ?? "مستخدم",
            isSuperAdmin: user?.isSuperAdmin ?? false,
            createdAt: user?.createdAt ?? member.createdAt,
          },
        };
      });
  }

  async inviteMember(companyId: string, email: string, role: MemberRole) {
    const normalized = email.trim().toLowerCase();
    const store = await readStore();
    const user = store.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) return { ok: false, error: "لا يوجد مستخدم مسجل بهذا البريد. يجب أن ينشئ حساباً أولاً." };
    if (store.members.some((m) => m.companyId === companyId && m.userId === user.id)) {
      return { ok: false, error: "المستخدم عضو في الشركة بالفعل." };
    }
    await mutateStore((s) => {
      s.members.push({
        id: `mem-${Date.now().toString(36)}`,
        companyId,
        userId: user.id,
        role,
        createdAt: new Date().toISOString(),
      });
    });
    return { ok: true };
  }

  async updateMemberRole(companyId: string, memberId: string, role: MemberRole): Promise<void> {
    await mutateStore((store) => {
      const member = store.members.find((m) => m.id === memberId && m.companyId === companyId);
      if (member) member.role = role;
    });
  }

  async removeMember(companyId: string, memberId: string): Promise<void> {
    await mutateStore((store) => {
      const member = store.members.find((m) => m.id === memberId && m.companyId === companyId);
      if (member && member.role !== "owner") {
        store.members = store.members.filter((m) => m.id !== memberId);
      }
    });
  }

  async listCustomRoles(companyId: string): Promise<CustomRole[]> {
    const store = await readStore();
    return store.roles.filter((role) => role.companyId === companyId);
  }

  async createCustomRole(
    companyId: string,
    userId: string,
    input: { name: string; description?: string | null; permissions: Permission[] },
  ): Promise<{ ok: boolean; role?: CustomRole; error?: string }> {
    const name = input.name.trim();
    if (name.length < 2) return { ok: false, error: "اسم الدور قصير جداً." };
    const store = await readStore();
    if (store.roles.some((role) => role.companyId === companyId && role.name === name)) {
      return { ok: false, error: "يوجد دور بهذا الاسم في الشركة." };
    }
    const role: CustomRole = {
      id: `role-${Date.now().toString(36)}`,
      companyId,
      name,
      description: input.description?.trim() || null,
      permissions: [...new Set(input.permissions)],
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
    await mutateStore((s) => {
      s.roles.push(role);
    });
    return { ok: true, role };
  }

  async updateCustomRole(
    companyId: string,
    roleId: string,
    patch: { name?: string; description?: string | null; permissions?: Permission[] },
  ): Promise<{ ok: boolean; error?: string }> {
    const store = await readStore();
    const existing = store.roles.find((role) => role.id === roleId && role.companyId === companyId);
    if (!existing) return { ok: false, error: "الدور غير موجود في هذه الشركة." };
    const name = patch.name?.trim();
    if (name && store.roles.some((role) => role.companyId === companyId && role.id !== roleId && role.name === name)) {
      return { ok: false, error: "يوجد دور بهذا الاسم في الشركة." };
    }
    await mutateStore((s) => {
      const role = s.roles.find((item) => item.id === roleId && item.companyId === companyId);
      if (!role) return;
      if (name) role.name = name;
      if (patch.description !== undefined) role.description = patch.description?.trim() || null;
      if (patch.permissions) role.permissions = [...new Set(patch.permissions)];
    });
    return { ok: true };
  }

  async deleteCustomRole(companyId: string, roleId: string): Promise<{ ok: boolean; error?: string }> {
    const store = await readStore();
    const exists = store.roles.some((role) => role.id === roleId && role.companyId === companyId);
    if (!exists) return { ok: false, error: "الدور غير موجود في هذه الشركة." };
    await mutateStore((s) => {
      s.roles = s.roles.filter((role) => !(role.id === roleId && role.companyId === companyId));
      for (const member of s.members) {
        if (member.companyId === companyId && member.customRoleId === roleId) member.customRoleId = null;
      }
    });
    return { ok: true };
  }

  async getMemberCustomRole(userId: string, companyId: string): Promise<CustomRole | null> {
    const store = await readStore();
    const member = store.members.find((item) => item.companyId === companyId && item.userId === userId);
    if (!member?.customRoleId) return null;
    return store.roles.find((role) => role.id === member.customRoleId && role.companyId === companyId) ?? null;
  }

  async setMemberCustomRole(
    companyId: string,
    memberId: string,
    roleId: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    const store = await readStore();
    const member = store.members.find((item) => item.id === memberId && item.companyId === companyId);
    if (!member) return { ok: false, error: "العضو غير موجود في هذه الشركة." };
    if (roleId) {
      const role = store.roles.find((item) => item.id === roleId && item.companyId === companyId);
      if (!role) return { ok: false, error: "الدور المخصص غير موجود في هذه الشركة." };
    }
    await mutateStore((s) => {
      const target = s.members.find((item) => item.id === memberId && item.companyId === companyId);
      if (target) target.customRoleId = roleId;
    });
    return { ok: true };
  }

  async listUsers(): Promise<AppUser[]> {
    const store = await readStore();
    return store.users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt,
    }));
  }

  async listActivity(companyId: string, limit = 20): Promise<ActivityLog[]> {
    const store = await readStore();
    return store.activity.filter((log) => log.companyId === companyId).slice(0, limit);
  }

  async log(
    companyId: string | null,
    userId: string,
    action: string,
    entity: string,
    entityId?: string,
    meta?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const entry: ActivityLog = {
      id: `log-${Date.now().toString(36)}`,
      companyId,
      userId,
      action,
      entity,
      entityId: entityId ?? null,
      meta,
      createdAt: new Date().toISOString(),
    };
    await mutateStore((store) => {
      store.activity.unshift(entry);
      if (companyId && store.data[companyId]) store.data[companyId].logs.unshift(entry);
    });
  }
}

let instance: Repository | null = null;

export function getRepository(): Repository {
  if (instance) return instance;
  instance = dataMode() === "supabase" ? createSupabaseRepository() : new DemoRepository();
  return instance;
}

export type { DemoRepository };
