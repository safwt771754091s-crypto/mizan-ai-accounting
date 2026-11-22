import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPANY_PERMISSIONS,
  COMPANY_ROLES,
  PERMISSIONS,
  PLATFORM_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  can,
  isPermission,
  permissionsFor,
} from "@/lib/auth/permission-catalog";

describe("كتالوج الصلاحيات", () => {
  it("لا يحتوي تكراراً وكل قيمة معروفة", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    for (const permission of PERMISSIONS) expect(isPermission(permission)).toBe(true);
    expect(isPermission("journal.delete_everything")).toBe(false);
  });

  it("كل صلاحية في أي دور معرّفة داخل الكتالوج", () => {
    for (const role of COMPANY_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("المالك يملك كل صلاحيات الشركة ولا يملك صلاحيات المنصة", () => {
    for (const permission of COMPANY_PERMISSIONS) {
      expect(can({ role: "owner" }, permission)).toBe(true);
    }
    expect(can({ role: "owner" }, "platform.users.manage")).toBe(false);
  });

  it("المدير لا يملك إدارة الأدوار ولا إعادة فتح الفترات", () => {
    expect(can({ role: "admin" }, "company.members.manage")).toBe(true);
    expect(can({ role: "admin" }, "company.roles.manage")).toBe(false);
    expect(can({ role: "admin" }, "periods.reopen")).toBe(false);
    expect(can({ role: "owner" }, "periods.reopen")).toBe(true);
  });

  it("المحاسب الأول يملك الترحيل دون الاعتماد", () => {
    expect(can({ role: "senior_accountant" }, "journal.post")).toBe(true);
    expect(can({ role: "senior_accountant" }, "journal.approve")).toBe(false);
    expect(can({ role: "accountant" }, "journal.post")).toBe(false);
  });

  it("المراجع والمشاهد للقراءة فقط", () => {
    for (const role of ["auditor", "viewer"] as const) {
      expect(can({ role }, "journal.create")).toBe(false);
      expect(can({ role }, "imports.create")).toBe(false);
      expect(can({ role }, "reports.view")).toBe(true);
    }
    expect(can({ role: "auditor" }, "findings.review")).toBe(true);
    expect(can({ role: "viewer" }, "findings.review")).toBe(false);
    expect(can({ role: "viewer" }, "company.members.read")).toBe(false);
  });

  it("الرفض هو الافتراضي عند غياب الدور أو الصلاحية", () => {
    expect(can(null, "reports.view")).toBe(false);
    expect(can({}, "reports.view")).toBe(false);
    expect(can({ role: null }, "reports.view")).toBe(false);
  });

  it("الدور المخصص يستبدل صلاحيات الدور النظامي ولا يتجاوز المالك", () => {
    const custom = ["reports.view", "journal.read"];
    expect(can({ role: "accountant", customPermissions: custom }, "imports.create")).toBe(false);
    expect(can({ role: "accountant", customPermissions: custom }, "reports.view")).toBe(true);
    expect(can({ role: "owner", customPermissions: custom }, "company.roles.manage")).toBe(true);
  });

  it("صلاحيات المنصة لا تمنح أي صلاحية على دفاتر العملاء", () => {
    for (const permission of PLATFORM_ROLE_PERMISSIONS.super_admin) {
      expect(can({ platformRole: "super_admin" }, permission)).toBe(true);
    }
    expect(can({ platformRole: "super_admin" }, "journal.post")).toBe(false);
    expect(can({ platformRole: "super_admin" }, "journal.read")).toBe(false);
  });

  it("مدير المنصة المحدود لا يملك إدارة المستخدمين", () => {
    expect(can({ platformRole: "platform_admin" }, "platform.users.read")).toBe(true);
    expect(can({ platformRole: "platform_admin" }, "platform.users.manage")).toBe(false);
    expect(can({ platformRole: "platform_admin" }, "platform.settings.manage")).toBe(false);
  });

  it("permissionsFor يعيد قائمة متوافقة مع can", () => {
    const list = permissionsFor({ role: "auditor" });
    expect(list).toContain("audit.view");
    expect(list).not.toContain("journal.create");
    for (const permission of list) expect(can({ role: "auditor" }, permission)).toBe(true);
  });
});

describe("تطابق ترحيل قاعدة البيانات مع الكتالوج", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0004_rbac.sql"), "utf8");
  const literals = new Set(
    [...sql.matchAll(/'([a-z_]+(?:\.[a-z_]+)+)'/g)].map((match) => match[1]).filter((value) => !value.startsWith("public.")),
  );

  it("كل صلاحية في الكتالوج مذكورة في الترحيل", () => {
    for (const permission of PERMISSIONS) {
      expect(literals, `الصلاحية ${permission} غائبة عن 0004_rbac.sql`).toContain(permission);
    }
  });

  it("الترحيل لا يعرّف صلاحية غير موجودة في الكتالوج", () => {
    for (const literal of literals) {
      expect(isPermission(literal), `صلاحية غير معروفة في SQL: ${literal}`).toBe(true);
    }
  });
});
