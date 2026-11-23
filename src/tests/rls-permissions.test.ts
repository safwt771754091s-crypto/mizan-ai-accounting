import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";

const read = (name: string) => readFileSync(path.join(process.cwd(), "supabase/migrations", name), "utf8");

const rls = read("0007_rls_permissions.sql");
const legacy = read("0003_security.sql");

interface Policy {
  name: string;
  table: string;
  command: string;
  body: string;
}

/** يستخرج سياسات CREATE POLICY مع جسمها، لأن اختبار النص وحده لا يكشف سياسة بلا فحص صلاحية. */
function policies(sql: string): Policy[] {
  const result: Policy[] = [];
  const pattern = /create policy\s+(\w+)\s+on\s+([\w.]+)\s+for\s+(select|insert|update|delete|all)([\s\S]*?);/gi;
  for (const match of sql.matchAll(pattern)) {
    result.push({ name: match[1], table: match[2], command: match[3].toLowerCase(), body: match[4] });
  }
  return result;
}

function droppedPolicies(sql: string): string[] {
  return [...sql.matchAll(/drop policy if exists\s+(\w+)/gi)].map((match) => match[1]);
}

const migrated = policies(rls);
const dropped = droppedPolicies(rls);
const legacyPolicies = policies(legacy);
/** السياسات الفعلية بعد كل المراحل: 0007 يعيد بناء سياسات 0003، و0005/0006 تضيف جداولها. */
const latest = new Map<string, Policy>();
for (const policy of [
  ...policies(read("0005_internal_controls.sql")),
  ...policies(read("0006_proposals.sql")),
  ...migrated,
]) {
  latest.set(policy.name, policy);
}
const effective = [...latest.values()];

describe("سياسات RLS بعد المرحلة 4", () => {
  it("كل سياسة كانت تفحص الدور النظامي أُسقطت وأُعيد بناؤها بالصلاحيات", () => {
    const rolePolicies = legacyPolicies.filter((policy) => policy.body.includes("has_company_role("));
    expect(rolePolicies.length).toBeGreaterThan(10);
    const missing = rolePolicies.map((policy) => policy.name).filter((name) => !dropped.includes(name));
    expect(missing, `سياسات بقيت بفحص الدور: ${missing.join(", ")}`).toEqual([]);
  });

  it("السياسات غير المرتبطة بالشركة (الملف الشخصي وإنشاء شركة) تبقى كما هي", () => {
    const untouched = ["profiles_select_self", "profiles_update_self", "companies_insert"];
    for (const name of untouched) {
      expect(dropped).not.toContain(name);
    }
  });

  it("كل سياسة جديدة تعتمد has_permission لا الدور النظامي", () => {
    const withoutPermission = migrated.filter((policy) => !policy.body.includes("has_permission("));
    expect(withoutPermission.map((policy) => policy.name)).toEqual([]);
  });

  it("لا تعتمد أي سياسة متبقية على مجرد العضوية بدل الصلاحية", () => {
    const membershipOnly = effective.filter((policy) => policy.body.includes("is_company_member("));
    expect(membershipOnly.map((policy) => policy.name)).toEqual([]);
  });

  it("لا توجد سياسة for all تلغي التفريق بين القراءة والكتابة", () => {
    expect(migrated.filter((policy) => policy.command === "all").map((policy) => policy.name)).toEqual([]);
  });

  it("كل صلاحية مذكورة في الترحيل موجودة في الكتالوج", () => {
    const literals = [...rls.matchAll(/'([a-z_]+\.[a-z_.]+)'/g)].map((match) => match[1]);
    const unknown = [...new Set(literals)].filter((value) => !(PERMISSIONS as readonly string[]).includes(value));
    expect(unknown).toEqual([]);
    expect(literals.length).toBeGreaterThan(20);
  });

  it("يغطي كل جدول محاسبي بسياسة قراءة وسياسة كتابة", () => {
    const expected: Record<string, { read: string; write: string[] }> = {
      "public.companies": { read: "company.read", write: ["company.settings.manage"] },
      "public.company_members": { read: "company.members.read", write: ["company.members.manage"] },
      "public.accounting_periods": { read: "periods.read", write: ["periods.close", "periods.reopen"] },
      "public.accounts": { read: "accounts.read", write: ["accounts.manage"] },
      "public.journal_entries": { read: "journal.read", write: ["journal.create", "journal.post", "journal.reverse"] },
      "public.journal_entry_lines": { read: "journal.read", write: ["journal.create", "journal.edit_draft"] },
      "public.uploaded_files": { read: "imports.read", write: ["imports.create"] },
      "public.import_batches": { read: "imports.read", write: ["imports.create"] },
      "public.imported_records": { read: "imports.read", write: ["imports.create"] },
      "public.audit_findings": { read: "findings.view", write: ["findings.review"] },
      "public.duplicate_findings": { read: "findings.view", write: ["findings.review"] },
      "public.financial_reports": { read: "reports.view", write: ["reports.export"] },
      "public.analysis_results": { read: "reports.view", write: ["reports.export"] },
      "public.activity_logs": { read: "company.read", write: ["company.read"] },
      "public.audit_logs": { read: "audit.view", write: ["company.read"] },
      "public.proposals": { read: "proposals.view", write: ["proposals.create", "proposals.triage"] },
      "public.roles": { read: "company.members.read", write: ["company.roles.manage"] },
      "public.role_permissions": { read: "company.members.read", write: ["company.roles.manage"] },
      "public.user_roles": { read: "company.members.read", write: ["company.members.manage"] },
      "storage.objects": { read: "imports.read", write: ["imports.create"] },
    };

    const byTable = new Map<string, Policy[]>();
    for (const policy of effective) {
      byTable.set(policy.table, [...(byTable.get(policy.table) ?? []), policy]);
    }

    for (const [table, requirement] of Object.entries(expected)) {
      const list = byTable.get(table) ?? [];
      expect(list.length, `لا سياسات للجدول ${table}`).toBeGreaterThan(0);
      const read = list.filter((policy) => policy.command === "select");
      expect(read.some((policy) => policy.body.includes(`'${requirement.read}'`)), `${table}: قراءة`).toBe(true);
      const writes = list.filter((policy) => policy.command !== "select");
      for (const permission of requirement.write) {
        expect(writes.some((policy) => policy.body.includes(`'${permission}'`)), `${table}: ${permission}`).toBe(true);
      }
    }
  });

  it("العضو يقرأ عضويته ودوره المخصص (شرط لتحميل سياق الشركة)", () => {
    const members = migrated.find((policy) => policy.name === "members_select");
    expect(members?.body).toContain("user_id = auth.uid()");
    expect(rls).toContain("function public.is_my_role");
    expect(migrated.find((policy) => policy.name === "roles_select")?.body).toContain("is_my_role(");
    expect(migrated.find((policy) => policy.name === "role_permissions_select")?.body).toContain("is_my_role(");
  });

  it("لا تسمح أي سياسة حذف في الجداول المحاسبية الحساسة", () => {
    const forbiddenDelete = ["public.accounting_periods", "public.audit_findings", "public.financial_reports"];
    const offenders = migrated.filter(
      (policy) => policy.command === "delete" && forbiddenDelete.includes(policy.table),
    );
    expect(offenders.map((policy) => policy.name)).toEqual([]);
  });

  it("جداول المرحلة 2 و3 (audit_logs وproposals) تُدار بالصلاحيات أيضاً", () => {
    const auditPolicies = effective.filter((policy) => policy.table === "public.audit_logs");
    expect(auditPolicies.length).toBeGreaterThan(0);
    for (const policy of auditPolicies) expect(policy.body).toContain("has_permission(");

    const proposalPolicies = effective.filter((policy) => policy.table === "public.proposals");
    expect(proposalPolicies.length).toBeGreaterThan(0);
    for (const policy of proposalPolicies) expect(policy.body).toContain("has_permission(");
  });
});
