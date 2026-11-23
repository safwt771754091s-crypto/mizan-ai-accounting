import type {
  AccountingPeriodStatus,
  Account,
  JournalEntry,
  JournalEntryStatus,
  Ledger,
} from "@/lib/accounting/types";
import type { Permission } from "@/lib/auth/permission-catalog";
import type { ImportBatchRecord } from "@/lib/import/types";
import { createSupabaseServerClient } from "../supabase/server";
import type { Repository, CompanyAccess } from "./repository";
import { canWrite } from "./types";
import type {
  ActivityLog,
  AppUser,
  AuditLog,
  Company,
  CompanyData,
  CompanyMember,
  CompanyWithAccess,
  CustomRole,
  FindingState,
  ImportSaveInput,
  MemberRole,
  Proposal,
  ProposalCategory,
  ProposalPriority,
  ProposalStatus,
} from "./types";

type Row = Record<string, unknown>;

function str(row: Row, key: string, fallback = ""): string {
  const value = row[key];
  return value === null || value === undefined ? fallback : String(value);
}

function num(row: Row, key: string): number {
  const value = row[key];
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCompany(row: Row): Company {
  return {
    id: str(row, "id"),
    name: str(row, "name"),
    legalName: str(row, "legal_name"),
    activityType: str(row, "activity_type"),
    country: str(row, "country", "SA"),
    currency: str(row, "currency", "SAR"),
    fiscalYearStart: str(row, "fiscal_year_start"),
    fiscalYearEnd: str(row, "fiscal_year_end"),
    entityType: str(row, "entity_type"),
    status: (str(row, "status", "active") as Company["status"]) ?? "active",
    taxNumber: row.tax_number ? String(row.tax_number) : null,
    registrationNumber: row.registration_number ? String(row.registration_number) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    city: row.city ? String(row.city) : null,
    address: row.address ? String(row.address) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: str(row, "created_at"),
    createdBy: str(row, "created_by"),
  };
}

function mapAccount(row: Row): Account {
  return {
    id: str(row, "id"),
    companyId: str(row, "company_id"),
    code: str(row, "code"),
    name: str(row, "name"),
    nameEn: row.name_en ? String(row.name_en) : undefined,
    type: str(row, "type", "asset") as Account["type"],
    subtype: str(row, "subtype", "other_asset") as Account["subtype"],
    parentId: row.parent_id ? String(row.parent_id) : null,
    isContra: Boolean(row.is_contra),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    openingBalance: row.opening_balance ? String(row.opening_balance) : undefined,
    openingBalanceType: row.opening_balance_type
      ? (String(row.opening_balance_type) as Account["openingBalanceType"])
      : undefined,
    currency: row.currency ? String(row.currency) : undefined,
  };
}

function mapEntry(row: Row, lines: Row[]): JournalEntry {
  return {
    id: str(row, "id"),
    companyId: str(row, "company_id"),
    entryNumber: str(row, "entry_number"),
    date: str(row, "entry_date"),
    description: str(row, "description"),
    reference: row.reference ? String(row.reference) : null,
    source: str(row, "source", "manual"),
    status: str(row, "status", "posted") as JournalEntry["status"],
    currency: str(row, "currency", "SAR"),
    exchangeRate: row.exchange_rate ? String(row.exchange_rate) : undefined,
    periodId: row.period_id ? String(row.period_id) : null,
    createdAt: str(row, "created_at"),
    createdBy: row.created_by ? String(row.created_by) : null,
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    postedBy: row.posted_by ? String(row.posted_by) : null,
    postedAt: row.posted_at ? String(row.posted_at) : null,
    rejectedBy: row.rejected_by ? String(row.rejected_by) : null,
    rejectedAt: row.rejected_at ? String(row.rejected_at) : null,
    reviewNote: row.review_note ? String(row.review_note) : null,
    lines: lines.map((line) => ({
      id: str(line, "id"),
      entryId: str(line, "entry_id"),
      accountId: line.account_id ? String(line.account_id) : undefined,
      accountCode: str(line, "account_code"),
      debit: str(line, "debit", "0"),
      credit: str(line, "credit", "0"),
      description: line.description ? String(line.description) : undefined,
      costCenter: line.cost_center ? String(line.cost_center) : null,
      branch: line.branch ? String(line.branch) : null,
      documentRef: line.document_ref ? String(line.document_ref) : null,
    })),
  };
}

function mapCustomRole(row: Row): CustomRole {
  const perms = (row.role_permissions as Row[] | null) ?? [];
  return {
    id: str(row, "id"),
    companyId: str(row, "company_id"),
    name: str(row, "name", "دور مخصص"),
    description: row.description ? String(row.description) : null,
    permissions: perms.map((item) => str(item, "permission")) as Permission[],
    createdAt: str(row, "created_at"),
    createdBy: str(row, "created_by"),
  };
}

class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;

  async listCompanies(userId: string): Promise<CompanyWithAccess[]> {
    const supabase = await createSupabaseServerClient();
    const { data: memberships, error } = await supabase
      .from("company_members")
      .select("company_id, role, companies(*)")
      .eq("user_id", userId);
    if (error || !memberships) return [];
    const results: CompanyWithAccess[] = [];
    for (const membership of memberships) {
      const companyRow = (membership as Row).companies as Row | null;
      if (!companyRow) continue;
      const company = mapCompany(companyRow);
      const { count: memberCount } = await supabase
        .from("company_members")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id);
      const { count: entryCount } = await supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id);
      results.push({
        ...company,
        role: str(membership as Row, "role", "viewer") as MemberRole,
        memberCount: memberCount ?? 0,
        entryCount: entryCount ?? 0,
      });
    }
    return results;
  }

  async getCompanyAccess(userId: string, companyId: string): Promise<CompanyAccess | null> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("company_members")
      .select("role, companies(*)")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const companyRow = (data as Row).companies as Row | null;
    if (!companyRow) return null;
    return { company: mapCompany(companyRow), role: str(data as Row, "role", "viewer") as MemberRole };
  }

  async createCompany(userId: string, input: Partial<Company> & { name: string }): Promise<Company> {
    const supabase = await createSupabaseServerClient();
    const fiscalYearStart = input.fiscalYearStart ?? `${new Date().getFullYear()}-01-01`;
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: input.name.trim(),
        legal_name: input.legalName ?? input.name.trim(),
        activity_type: input.activityType ?? "غير محدد",
        country: input.country ?? "SA",
        currency: input.currency ?? "SAR",
        fiscal_year_start: fiscalYearStart,
        fiscal_year_end: input.fiscalYearEnd ?? `${fiscalYearStart.slice(0, 4)}-12-31`,
        entity_type: input.entityType ?? "شركة",
        status: "active",
        tax_number: input.taxNumber ?? null,
        registration_number: input.registrationNumber ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        city: input.city ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error("تعذر إنشاء الشركة.");
    const company = mapCompany(data as Row);
    await supabase.from("company_members").insert({ company_id: company.id, user_id: userId, role: "owner" });
    await supabase.from("accounting_periods").insert({
      company_id: company.id,
      name: `السنة المالية ${fiscalYearStart.slice(0, 4)}`,
      start_date: `${fiscalYearStart.slice(0, 4)}-01-01`,
      end_date: `${fiscalYearStart.slice(0, 4)}-12-31`,
      status: "open",
    });
    return company;
  }

  async updateCompany(userId: string, companyId: string, patch: Partial<Company>): Promise<Company | null> {
    const access = await this.getCompanyAccess(userId, companyId);
    if (!access || !canWrite(access.role)) return null;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("companies")
      .update({
        name: patch.name,
        legal_name: patch.legalName,
        activity_type: patch.activityType,
        country: patch.country,
        currency: patch.currency,
        fiscal_year_start: patch.fiscalYearStart,
        fiscal_year_end: patch.fiscalYearEnd,
        entity_type: patch.entityType,
        status: patch.status,
        tax_number: patch.taxNumber,
        registration_number: patch.registrationNumber,
        phone: patch.phone,
        email: patch.email,
        city: patch.city,
        address: patch.address,
        notes: patch.notes,
      })
      .eq("id", companyId)
      .select("*")
      .maybeSingle();
    if (error || !data) return null;
    return mapCompany(data as Row);
  }

  async getCompanyData(companyId: string): Promise<CompanyData> {
    const supabase = await createSupabaseServerClient();
    const [accountsRes, entriesRes, linesRes, periodsRes, batchesRes, recordsRes, findingsRes, logsRes] =
      await Promise.all([
        supabase.from("accounts").select("*").eq("company_id", companyId).order("code"),
        supabase.from("journal_entries").select("*").eq("company_id", companyId).order("entry_date"),
        supabase.from("journal_entry_lines").select("*").eq("company_id", companyId),
        supabase.from("accounting_periods").select("*").eq("company_id", companyId),
        supabase.from("import_batches").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("imported_records").select("*").eq("company_id", companyId).limit(2000),
        supabase.from("audit_findings").select("*").eq("company_id", companyId),
        supabase.from("activity_logs").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50),
      ]);

    const linesByEntry = new Map<string, Row[]>();
    for (const line of (linesRes.data ?? []) as Row[]) {
      const key = str(line, "entry_id");
      linesByEntry.set(key, [...(linesByEntry.get(key) ?? []), line]);
    }

    return {
      accounts: ((accountsRes.data ?? []) as Row[]).map(mapAccount),
      entries: ((entriesRes.data ?? []) as Row[]).map((row) =>
        mapEntry(row, linesByEntry.get(str(row, "id")) ?? []),
      ),
      periods: ((periodsRes.data ?? []) as Row[]).map((row) => ({
        id: str(row, "id"),
        companyId: str(row, "company_id"),
        name: str(row, "name"),
        startDate: str(row, "start_date"),
        endDate: str(row, "end_date"),
        status: str(row, "status", "open") as "open" | "closed" | "locked",
      })),
      batches: ((batchesRes.data ?? []) as Row[]).map((row) => ({
        id: str(row, "id"),
        companyId: str(row, "company_id"),
        fileName: str(row, "file_name"),
        fileKind: str(row, "file_kind", "csv") as ImportBatchRecord["fileKind"],
        sizeBytes: num(row, "size_bytes"),
        checksum: str(row, "checksum"),
        dataset: str(row, "dataset") as ImportBatchRecord["dataset"],
        sheetName: str(row, "sheet_name"),
        mapping: (row.mapping as ImportBatchRecord["mapping"]) ?? {},
        rowCount: num(row, "row_count"),
        importedCount: num(row, "imported_count"),
        skippedCount: num(row, "skipped_count"),
        errorCount: num(row, "error_count"),
        warningCount: num(row, "warning_count"),
        status: str(row, "status", "completed") as ImportBatchRecord["status"],
        createdAt: str(row, "created_at"),
        createdBy: str(row, "created_by"),
        issues: (row.issues as ImportBatchRecord["issues"]) ?? [],
        warnings: (row.warnings as string[]) ?? [],
      })),
      records: ((recordsRes.data ?? []) as Row[]).map((row) => ({
        id: str(row, "id"),
        companyId: str(row, "company_id"),
        batchId: str(row, "batch_id"),
        dataset: str(row, "dataset"),
        rowNumber: num(row, "row_number"),
        data: (row.data as Record<string, string>) ?? {},
        createdAt: str(row, "created_at"),
      })),
      findingStates: ((findingsRes.data ?? []) as Row[]).map((row) => ({
        findingId: str(row, "finding_key"),
        companyId: str(row, "company_id"),
        status: str(row, "status", "open") as FindingState["status"],
        note: row.note ? String(row.note) : null,
        updatedAt: str(row, "updated_at"),
        updatedBy: str(row, "updated_by"),
      })),
      logs: ((logsRes.data ?? []) as Row[]).map((row) => ({
        id: str(row, "id"),
        companyId: str(row, "company_id"),
        userId: str(row, "user_id"),
        action: str(row, "action"),
        entity: str(row, "entity"),
        entityId: row.entity_id ? String(row.entity_id) : null,
        meta: (row.meta as ActivityLog["meta"]) ?? undefined,
        createdAt: str(row, "created_at"),
      })),
    };
  }

  async getLedger(companyId: string): Promise<Ledger> {
    const data = await this.getCompanyData(companyId);
    const accessCompany = data.accounts[0]?.companyId;
    const supabase = await createSupabaseServerClient();
    const { data: company } = await supabase.from("companies").select("currency").eq("id", companyId).maybeSingle();
    void accessCompany;
    return {
      accounts: data.accounts,
      entries: data.entries,
      periods: data.periods,
      currency: company ? str(company as Row, "currency", "SAR") : "SAR",
    };
  }

  async saveImport(
    companyId: string,
    userId: string,
    input: ImportSaveInput,
    entryStatus: "posted" | "submitted" = "posted",
  ) {
    const access = await this.getCompanyAccess(userId, companyId);
    if (!access || !canWrite(access.role)) throw new Error("لا تملك صلاحية استيراد البيانات لهذه الشركة.");
    const supabase = await createSupabaseServerClient();

    const { data: existingBatch } = await supabase
      .from("import_batches")
      .select("*")
      .eq("company_id", companyId)
      .eq("checksum", input.batch.checksum)
      .eq("dataset", input.batch.dataset)
      .maybeSingle();
    if (existingBatch) {
      return {
        batch: {
          ...input.batch,
          id: str(existingBatch as Row, "id"),
          companyId,
          createdAt: str(existingBatch as Row, "created_at"),
          createdBy: str(existingBatch as Row, "created_by"),
        } as ImportBatchRecord,
        skipped: 0,
        duplicate: true,
      };
    }

    const { data: batchRow, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        company_id: companyId,
        file_name: input.batch.fileName,
        file_kind: input.batch.fileKind,
        size_bytes: input.batch.sizeBytes,
        checksum: input.batch.checksum,
        dataset: input.batch.dataset,
        sheet_name: input.batch.sheetName,
        mapping: input.batch.mapping,
        row_count: input.batch.rowCount,
        imported_count: input.batch.importedCount,
        skipped_count: input.batch.skippedCount,
        error_count: input.batch.errorCount,
        warning_count: input.batch.warningCount,
        status: input.batch.status,
        issues: input.batch.issues,
        warnings: input.batch.warnings,
        created_by: userId,
      })
      .select("*")
      .single();
    if (batchError || !batchRow) throw new Error("تعذر تسجيل عملية الاستيراد.");
    const batchId = str(batchRow as Row, "id");

    if (input.accounts.length) {
      await supabase.from("accounts").upsert(
        input.accounts.map((account) => ({
          company_id: companyId,
          code: account.code,
          name: account.name,
          type: account.accountType ?? "asset",
          subtype: account.subtype ?? "other_asset",
          opening_balance: Math.abs(account.debit - account.credit),
          opening_balance_type: account.debit >= account.credit ? "debit" : "credit",
        })),
        { onConflict: "company_id,code" },
      );
    }

    let skipped = 0;
    if (input.entries.length) {
      const { data: accountRows } = await supabase.from("accounts").select("id, code").eq("company_id", companyId);
      const accountIds = new Map<string, string>();
      for (const row of (accountRows ?? []) as Row[]) accountIds.set(str(row, "code"), str(row, "id"));

      for (const draft of input.entries) {
        const { data: existingEntry } = await supabase
          .from("journal_entries")
          .select("id")
          .eq("company_id", companyId)
          .eq("entry_number", draft.entryNumber)
          .maybeSingle();
        if (existingEntry) {
          skipped += 1;
          continue;
        }
        const { data: entryRow, error: entryError } = await supabase
          .from("journal_entries")
          .insert({
            company_id: companyId,
            entry_number: draft.entryNumber,
            entry_date: draft.date,
            description: draft.description,
            reference: draft.reference ?? null,
            source: input.batch.dataset,
            status: entryStatus,
            created_by: userId,
            submitted_by: entryStatus === "submitted" ? userId : null,
            submitted_at: entryStatus === "submitted" ? new Date().toISOString() : null,
            currency: access.company.currency,
          })
          .select("id")
          .single();
        if (entryError || !entryRow) continue;
        const entryId = str(entryRow as Row, "id");
        await supabase.from("journal_entry_lines").insert(
          draft.lines.map((line) => ({
            entry_id: entryId,
            company_id: companyId,
            account_id: accountIds.get(line.accountCode) ?? null,
            account_code: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            description: line.description ?? null,
            cost_center: line.costCenter ?? null,
            branch: line.branch ?? null,
          })),
        );
      }
    }

    if (input.records.length) {
      await supabase.from("imported_records").insert(
        input.records.slice(0, 2000).map((record) => ({
          company_id: companyId,
          batch_id: batchId,
          dataset: input.batch.dataset,
          row_number: record.rowNumber,
          data: record.values,
        })),
      );
    }

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: "import_completed",
      entity: "import_batch",
      entity_id: batchId,
      meta: { rows: input.batch.rowCount, dataset: input.batch.dataset, fileName: input.batch.fileName },
    });

    return {
      batch: {
        ...input.batch,
        id: batchId,
        companyId,
        createdAt: str(batchRow as Row, "created_at"),
        createdBy: userId,
        skippedCount: input.batch.skippedCount + skipped,
      } as ImportBatchRecord,
      skipped,
      duplicate: false,
    };
  }

  async setFindingStatus(
    companyId: string,
    userId: string,
    findingId: string,
    status: FindingState["status"],
    note?: string,
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.from("audit_findings").upsert(
      {
        company_id: companyId,
        finding_key: findingId,
        status,
        note: note ?? null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,finding_key" },
    );
  }

  async listMembers(companyId: string): Promise<Array<CompanyMember & { user: AppUser }>> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("company_members")
      .select("id, company_id, user_id, role, created_at, profiles(*)")
      .eq("company_id", companyId);
    return ((data ?? []) as Row[]).map((row) => {
      const profile = (row.profiles as Row | null) ?? {};
      return {
        id: str(row, "id"),
        companyId: str(row, "company_id"),
        userId: str(row, "user_id"),
        role: str(row, "role", "viewer") as MemberRole,
        createdAt: str(row, "created_at"),
        user: {
          id: str(row, "user_id"),
          email: str(profile, "email"),
          fullName: str(profile, "full_name", "مستخدم"),
          isSuperAdmin: str(profile, "role", "user") === "super_admin",
          createdAt: str(profile, "created_at"),
        },
      };
    });
  }

  async inviteMember(companyId: string, email: string, role: MemberRole) {
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (!profile) return { ok: false, error: "لا يوجد مستخدم مسجل بهذا البريد." };
    const { error } = await supabase.from("company_members").insert({
      company_id: companyId,
      user_id: str(profile as Row, "id"),
      role,
    });
    if (error) return { ok: false, error: "تعذر إضافة العضو. قد يكون موجوداً بالفعل." };
    return { ok: true };
  }

  async updateMemberRole(companyId: string, memberId: string, role: MemberRole): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.from("company_members").update({ role }).eq("id", memberId).eq("company_id", companyId);
  }

  async removeMember(companyId: string, memberId: string): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.from("company_members").delete().eq("id", memberId).eq("company_id", companyId).neq("role", "owner");
  }

  async listCustomRoles(companyId: string): Promise<CustomRole[]> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("roles")
      .select("id, company_id, name, description, created_at, created_by, role_permissions(permission)")
      .eq("company_id", companyId)
      .eq("is_system", false)
      .order("created_at");
    return ((data ?? []) as Row[]).map(mapCustomRole);
  }

  async createCustomRole(
    companyId: string,
    userId: string,
    input: { name: string; description?: string | null; permissions: Permission[] },
  ): Promise<{ ok: boolean; role?: CustomRole; error?: string }> {
    const name = input.name.trim();
    if (name.length < 2) return { ok: false, error: "اسم الدور قصير جداً." };
    const supabase = await createSupabaseServerClient();
    const { data: created, error } = await supabase
      .from("roles")
      .insert({
        company_id: companyId,
        name,
        description: input.description?.trim() || null,
        is_system: false,
        created_by: userId,
      })
      .select("id, company_id, name, description, created_at, created_by")
      .single();
    if (error || !created) return { ok: false, error: "تعذر إنشاء الدور. تحقق من الصلاحيات." };
    const roleId = str(created as Row, "id");
    const permissions = [...new Set(input.permissions)];
    if (permissions.length) {
      const { error: permError } = await supabase
        .from("role_permissions")
        .insert(permissions.map((permission) => ({ role_id: roleId, permission })));
      if (permError) return { ok: false, error: "تعذر حفظ صلاحيات الدور." };
    }
    return {
      ok: true,
      role: {
        id: roleId,
        companyId,
        name,
        description: input.description?.trim() || null,
        permissions,
        createdAt: str(created as Row, "created_at"),
        createdBy: userId,
      },
    };
  }

  async updateCustomRole(
    companyId: string,
    roleId: string,
    patch: { name?: string; description?: string | null; permissions?: Permission[] },
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("id", roleId)
      .eq("company_id", companyId)
      .eq("is_system", false)
      .maybeSingle();
    if (!existing) return { ok: false, error: "الدور غير موجود في هذه الشركة." };

    const update: Record<string, unknown> = {};
    if (patch.name?.trim()) update.name = patch.name.trim();
    if (patch.description !== undefined) update.description = patch.description?.trim() || null;
    if (Object.keys(update).length) {
      const { error } = await supabase.from("roles").update(update).eq("id", roleId).eq("company_id", companyId);
      if (error) return { ok: false, error: "تعذر تحديث الدور." };
    }
    if (patch.permissions) {
      const permissions = [...new Set(patch.permissions)];
      await supabase.from("role_permissions").delete().eq("role_id", roleId);
      if (permissions.length) {
        const { error } = await supabase
          .from("role_permissions")
          .insert(permissions.map((permission) => ({ role_id: roleId, permission })));
        if (error) return { ok: false, error: "تعذر حفظ صلاحيات الدور." };
      }
    }
    return { ok: true };
  }

  async deleteCustomRole(companyId: string, roleId: string): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("roles")
      .delete()
      .eq("id", roleId)
      .eq("company_id", companyId)
      .eq("is_system", false);
    if (error) return { ok: false, error: "تعذر حذف الدور." };
    return { ok: true };
  }

  async getMemberCustomRole(userId: string, companyId: string): Promise<CustomRole | null> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("company_members")
      .select("custom_role_id, roles(id, company_id, name, description, created_at, created_by, role_permissions(permission))")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();
    const roleRow = (data as Row | null)?.roles as Row | null;
    if (!roleRow) return null;
    return mapCustomRole(roleRow);
  }

  async setMemberCustomRole(
    companyId: string,
    memberId: string,
    roleId: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createSupabaseServerClient();
    if (roleId) {
      const { data: role } = await supabase
        .from("roles")
        .select("id")
        .eq("id", roleId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!role) return { ok: false, error: "الدور المخصص غير موجود في هذه الشركة." };
    }
    const { error } = await supabase
      .from("company_members")
      .update({ custom_role_id: roleId })
      .eq("id", memberId)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: "تعذر تعيين الدور المخصص." };
    return { ok: true };
  }

  async updateEntryStatus(
    companyId: string,
    entryId: string,
    patch: { status: JournalEntryStatus; userId: string; note?: string | null; at?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const at = patch.at ?? new Date().toISOString();
    const update: Record<string, unknown> = { status: patch.status };
    if (patch.status === "submitted") {
      update.submitted_by = patch.userId;
      update.submitted_at = at;
    } else if (patch.status === "approved") {
      update.approved_by = patch.userId;
      update.approved_at = at;
    } else if (patch.status === "rejected") {
      update.rejected_by = patch.userId;
      update.rejected_at = at;
      update.review_note = patch.note ?? null;
    } else if (patch.status === "posted") {
      update.posted_by = patch.userId;
      update.posted_at = at;
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("journal_entries")
      .update(update)
      .eq("id", entryId)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: "تعذر تحديث حالة القيد." };
    return { ok: true };
  }

  async appendAudit(
    companyId: string,
    userId: string,
    input: {
      action: string;
      entity: string;
      entityId?: string | null;
      fromStatus?: string | null;
      toStatus?: string | null;
      note?: string | null;
      meta?: Record<string, string | number | boolean | null>;
    },
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.from("audit_logs").insert({
      company_id: companyId,
      user_id: userId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      note: input.note ?? null,
      meta: input.meta ?? null,
    });
  }

  async listAudit(companyId: string, limit = 100): Promise<AuditLog[]> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as Row[]).map((row) => ({
      id: str(row, "id"),
      companyId: str(row, "company_id"),
      userId: str(row, "user_id"),
      action: str(row, "action"),
      entity: str(row, "entity"),
      entityId: row.entity_id ? String(row.entity_id) : null,
      fromStatus: row.from_status ? String(row.from_status) : null,
      toStatus: row.to_status ? String(row.to_status) : null,
      note: row.note ? String(row.note) : null,
      meta: (row.meta as AuditLog["meta"]) ?? undefined,
      createdAt: str(row, "created_at"),
    }));
  }

  async setPeriodStatus(
    companyId: string,
    periodId: string,
    status: AccountingPeriodStatus,
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("accounting_periods")
      .update({ status })
      .eq("id", periodId)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: "تعذر تحديث حالة الفترة المالية." };
    return { ok: true };
  }

  async listProposals(companyId: string): Promise<Proposal[]> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("proposals")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    return ((data ?? []) as Row[]).map((row) => ({
      id: str(row, "id"),
      companyId: str(row, "company_id"),
      title: str(row, "title"),
      body: str(row, "body"),
      category: str(row, "category", "other") as ProposalCategory,
      priority: str(row, "priority", "medium") as ProposalPriority,
      status: str(row, "status", "new") as ProposalStatus,
      createdBy: str(row, "created_by"),
      createdAt: str(row, "created_at"),
      updatedAt: str(row, "updated_at", str(row, "created_at")),
      decisionNote: row.decision_note ? str(row, "decision_note") : null,
      issueNumber: row.issue_number === null || row.issue_number === undefined ? null : Number(row.issue_number),
      issueUrl: row.issue_url ? str(row, "issue_url") : null,
    }));
  }

  async createProposal(
    companyId: string,
    userId: string,
    input: { title: string; body: string; category: ProposalCategory; priority: ProposalPriority },
  ): Promise<Proposal> {
    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("proposals")
      .insert({
        company_id: companyId,
        title: input.title,
        body: input.body,
        category: input.category,
        priority: input.priority,
        status: "new",
        created_by: userId,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error("تعذر حفظ المقترح.");
    const row = data as Row;
    return {
      id: str(row, "id"),
      companyId,
      title: input.title,
      body: input.body,
      category: input.category,
      priority: input.priority,
      status: "new",
      createdBy: userId,
      createdAt: str(row, "created_at", now),
      updatedAt: str(row, "updated_at", now),
      decisionNote: null,
      issueNumber: null,
      issueUrl: null,
    };
  }

  async setProposalStatus(
    companyId: string,
    proposalId: string,
    status: ProposalStatus,
    _userId: string,
    note?: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createSupabaseServerClient();
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (note !== undefined) patch.decision_note = note;
    const { error } = await supabase
      .from("proposals")
      .update(patch)
      .eq("id", proposalId)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: "تعذر تحديث حالة المقترح." };
    return { ok: true };
  }

  async attachProposalIssue(
    companyId: string,
    proposalId: string,
    issue: { number: number; url: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("proposals")
      .update({ issue_number: issue.number, issue_url: issue.url, updated_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: "تعذر ربط المقترح بـ Issue." };
    return { ok: true };
  }

  async listUsers(): Promise<AppUser[]> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    return ((data ?? []) as Row[]).map((row) => ({
      id: str(row, "id"),
      email: str(row, "email"),
      fullName: str(row, "full_name", "مستخدم"),
      isSuperAdmin: str(row, "role", "user") === "super_admin",
      createdAt: str(row, "created_at"),
    }));
  }

  async listActivity(companyId: string, limit = 20): Promise<ActivityLog[]> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as Row[]).map((row) => ({
      id: str(row, "id"),
      companyId: str(row, "company_id"),
      userId: str(row, "user_id"),
      action: str(row, "action"),
      entity: str(row, "entity"),
      entityId: row.entity_id ? String(row.entity_id) : null,
      meta: (row.meta as ActivityLog["meta"]) ?? undefined,
      createdAt: str(row, "created_at"),
    }));
  }

  async log(
    companyId: string | null,
    userId: string,
    action: string,
    entity: string,
    entityId?: string,
    meta?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.from("activity_logs").insert({
      company_id: companyId,
      user_id: userId,
      action,
      entity,
      entity_id: entityId ?? null,
      meta: meta ?? null,
    });
  }
}

export function createSupabaseRepository(): Repository {
  return new SupabaseRepository();
}
