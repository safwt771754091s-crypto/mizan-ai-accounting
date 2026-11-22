import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.RAKAZ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "rakaz-rbac-"));
process.env.RAKAZ_DATA_MODE = "demo";

let repo: import("@/lib/data/repository").Repository;
let resolveCompanyPermission: typeof import("@/lib/auth/permissions").resolveCompanyPermission;
let assertCompanyPermission: typeof import("@/lib/auth/permissions").assertCompanyPermission;
let users: Record<string, import("@/lib/data/types").AppUser>;

beforeAll(async () => {
  const { getRepository } = await import("@/lib/data/repository");
  const permissions = await import("@/lib/auth/permissions");
  repo = getRepository();
  resolveCompanyPermission = permissions.resolveCompanyPermission;
  assertCompanyPermission = permissions.assertCompanyPermission;
  const list = await repo.listUsers();
  users = Object.fromEntries(list.map((user) => [user.id, user]));
});

describe("تحقق الصلاحيات داخل نطاق الشركة", () => {
  it("المشاهد يقرأ التقارير ولا يستورد", async () => {
    const state = await resolveCompanyPermission(users["user-viewer"], "co-nakheel");
    expect(state).not.toBeNull();
    expect(state!.allows("reports.view")).toBe(true);
    expect(state!.allows("imports.create")).toBe(false);
    expect(state!.allows("company.members.read")).toBe(false);
  });

  it("المراجع يملك مراجعة الاكتشافات دون كتابة القيود", async () => {
    const state = await resolveCompanyPermission(users["user-auditor"], "co-nakheel");
    expect(state!.allows("findings.review")).toBe(true);
    expect(state!.allows("journal.create")).toBe(false);
    expect(state!.allows("audit.view")).toBe(true);
  });

  it("المالك يملك إدارة الأدوار وإعادة فتح الفترات", async () => {
    const state = await resolveCompanyPermission(users["user-demo"], "co-nakheel");
    expect(state!.allows("company.roles.manage")).toBe(true);
    expect(state!.allows("periods.reopen")).toBe(true);
  });

  it("المدير لا يملك إدارة الأدوار", async () => {
    const state = await resolveCompanyPermission(users["user-demo"], "co-rakaz");
    expect(state!.access.role).toBe("admin");
    expect(state!.allows("company.members.manage")).toBe(true);
    expect(state!.allows("company.roles.manage")).toBe(false);
  });

  it("يرفض الوصول إلى شركة لا تربطها بالمستخدم عضوية", async () => {
    expect(await resolveCompanyPermission(users["user-viewer"], "co-ufuq")).toBeNull();
    expect(await resolveCompanyPermission(users["user-auditor"], "co-rakaz")).toBeNull();
  });

  it("البوابة الموحدة ترجع 401 لغير المسجل و403 لغير العضو", async () => {
    const anonymous = await assertCompanyPermission(null, "co-nakheel", "reports.view");
    expect(anonymous).toMatchObject({ ok: false, status: 401 });

    const outsider = await assertCompanyPermission(users["user-viewer"], "co-ufuq", "reports.view");
    expect(outsider).toMatchObject({ ok: false, status: 403 });

    const denied = await assertCompanyPermission(users["user-viewer"], "co-nakheel", "imports.create");
    expect(denied).toMatchObject({ ok: false, status: 403 });

    const granted = await assertCompanyPermission(users["user-demo"], "co-nakheel", "imports.create");
    expect(granted.ok).toBe(true);
  });
});

describe("الأدوار المخصصة", () => {
  it("تنشئ دوراً مخصصاً بصلاحيات محددة وتطبّقه على عضو", async () => {
    const created = await repo.createCustomRole("co-nakheel", "user-demo", {
      name: "محاسب تقارير",
      description: "قراءة التقارير فقط",
      permissions: ["reports.view", "journal.read"],
    });
    expect(created.ok).toBe(true);
    const role = created.role!;

    const members = await repo.listMembers("co-nakheel");
    const accountant = members.find((member) => member.userId === "user-viewer");
    expect(accountant).toBeDefined();

    const assigned = await repo.setMemberCustomRole("co-nakheel", accountant!.id, role.id);
    expect(assigned.ok).toBe(true);

    const state = await resolveCompanyPermission(users["user-viewer"], "co-nakheel");
    expect(state!.allows("reports.view")).toBe(true);
    expect(state!.allows("journal.read")).toBe(true);
    // الدور المخصص يستبدل صلاحيات viewer النظامية
    expect(state!.allows("accounts.read")).toBe(false);
    expect(state!.allows("imports.create")).toBe(false);

    const denied = await assertCompanyPermission(users["user-viewer"], "co-nakheel", "accounts.read");
    expect(denied).toMatchObject({ ok: false, status: 403 });

    const cleaned = await repo.deleteCustomRole("co-nakheel", role.id);
    expect(cleaned.ok).toBe(true);
    expect(await repo.getMemberCustomRole("user-viewer", "co-nakheel")).toBeNull();

    const restored = await resolveCompanyPermission(users["user-viewer"], "co-nakheel");
    expect(restored!.allows("accounts.read")).toBe(true);
  });

  it("لا تسمح بتكرار اسم الدور داخل الشركة نفسها", async () => {
    const first = await repo.createCustomRole("co-nakheel", "user-demo", {
      name: "مدقق مخزون",
      permissions: ["accounts.read"],
    });
    expect(first.ok).toBe(true);
    const duplicate = await repo.createCustomRole("co-nakheel", "user-demo", {
      name: "مدقق مخزون",
      permissions: ["reports.view"],
    });
    expect(duplicate.ok).toBe(false);
    await repo.deleteCustomRole("co-nakheel", first.role!.id);
  });

  it("أدوار الشركة لا تتسرب إلى شركة أخرى", async () => {
    const created = await repo.createCustomRole("co-nakheel", "user-demo", {
      name: "دور خاص بالنخيل",
      permissions: ["reports.view"],
    });
    expect(created.ok).toBe(true);

    const other = await repo.listCustomRoles("co-ufuq");
    expect(other.map((role) => role.name)).not.toContain("دور خاص بالنخيل");

    const hijack = await repo.setMemberCustomRole("co-ufuq", "m2", created.role!.id);
    expect(hijack.ok).toBe(false);

    const foreignDelete = await repo.deleteCustomRole("co-ufuq", created.role!.id);
    expect(foreignDelete.ok).toBe(false);

    await repo.deleteCustomRole("co-nakheel", created.role!.id);
  });

  it("تعيين دور مخصص غير موجود يُرفض", async () => {
    const members = await repo.listMembers("co-nakheel");
    const result = await repo.setMemberCustomRole("co-nakheel", members[0].id, "role-does-not-exist");
    expect(result.ok).toBe(false);
  });
});
