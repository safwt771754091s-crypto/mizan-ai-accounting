/**
 * كتالوج الصلاحيات — المصدر الوحيد للحقيقة في طبقة التطبيق.
 * لا يستورد أي شيء من طبقة البيانات لتفادي الدورات، ويُطابق
 * محتوى الترحيل supabase/migrations/0004_rbac.sql.
 */

export const PERMISSIONS = [
  // الشركة والعضوية
  "company.read",
  "company.settings.manage",
  "company.members.read",
  "company.members.manage",
  "company.roles.manage",
  "company.branches.manage",
  // دليل الحسابات
  "accounts.read",
  "accounts.manage",
  // القيود اليومية
  "journal.read",
  "journal.create",
  "journal.edit_draft",
  "journal.submit",
  "journal.approve",
  "journal.post",
  "journal.reverse",
  "journal.export",
  // الاستيراد
  "imports.read",
  "imports.create",
  // الفترات المالية
  "periods.read",
  "periods.close",
  "periods.reopen",
  // التقارير
  "reports.view",
  "reports.export",
  // المراجعة والاكتشافات
  "findings.view",
  "findings.review",
  "audit.view",
  // المقترحات (تُستخدم في المرحلة الثالثة)
  "proposals.create",
  "proposals.view",
  "proposals.triage",
  // المنصة
  "platform.users.read",
  "platform.users.manage",
  "platform.companies.read",
  "platform.companies.manage",
  "platform.settings.manage",
  "platform.audit.view",
  "platform.proposals.manage",
  "platform.stats.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const COMPANY_ROLES = [
  "owner",
  "admin",
  "senior_accountant",
  "accountant",
  "auditor",
  "viewer",
] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "مالك",
  admin: "مدير",
  senior_accountant: "محاسب أول",
  accountant: "محاسب",
  auditor: "مراجع",
  viewer: "مشاهد",
};

export const ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  owner: "كل صلاحيات الشركة، بما فيها إدارة الأدوار وإعادة فتح الفترات.",
  admin: "إدارة العمليات اليومية والمستخدمين دون تغيير الأدوار أو إعادة فتح الفترات.",
  senior_accountant: "إدخال القيود وترحيلها وإدارة دليل الحسابات والاستيراد.",
  accountant: "إدخال القيود وإرسالها للمراجعة وإدارة الاستيراد، دون الترحيل النهائي.",
  auditor: "قراءة كاملة ومراجعة الاكتشافات وسجل التدقيق دون أي تعديل.",
  viewer: "قراءة التقارير والبيانات دون أي تعديل.",
};

const COMPANY_ALL: Permission[] = [
  "company.read",
  "company.settings.manage",
  "company.members.read",
  "company.members.manage",
  "company.roles.manage",
  "company.branches.manage",
  "accounts.read",
  "accounts.manage",
  "journal.read",
  "journal.create",
  "journal.edit_draft",
  "journal.submit",
  "journal.approve",
  "journal.post",
  "journal.reverse",
  "journal.export",
  "imports.read",
  "imports.create",
  "periods.read",
  "periods.close",
  "periods.reopen",
  "reports.view",
  "reports.export",
  "findings.view",
  "findings.review",
  "audit.view",
  "proposals.create",
  "proposals.view",
  "proposals.triage",
];

export const ROLE_PERMISSIONS: Record<CompanyRole, readonly Permission[]> = {
  owner: COMPANY_ALL,
  admin: COMPANY_ALL.filter(
    (permission) =>
      permission !== "company.roles.manage" && permission !== "periods.reopen",
  ),
  senior_accountant: [
    "company.read",
    "company.members.read",
    "accounts.read",
    "accounts.manage",
    "journal.read",
    "journal.create",
    "journal.edit_draft",
    "journal.submit",
    "journal.post",
    "journal.export",
    "imports.read",
    "imports.create",
    "periods.read",
    "reports.view",
    "reports.export",
    "findings.view",
    "audit.view",
    "proposals.create",
    "proposals.view",
  ],
  accountant: [
    "company.read",
    "accounts.read",
    "journal.read",
    "journal.create",
    "journal.edit_draft",
    "journal.submit",
    "journal.export",
    "imports.read",
    "imports.create",
    "periods.read",
    "reports.view",
    "findings.view",
    "proposals.create",
    "proposals.view",
  ],
  auditor: [
    "company.read",
    "company.members.read",
    "accounts.read",
    "journal.read",
    "imports.read",
    "periods.read",
    "reports.view",
    "findings.view",
    "findings.review",
    "audit.view",
    "proposals.create",
    "proposals.view",
  ],
  viewer: ["company.read", "accounts.read", "journal.read", "periods.read", "reports.view", "findings.view"],
};

export const PLATFORM_ROLES = ["super_admin", "platform_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly Permission[]> = {
  super_admin: [
    "platform.users.read",
    "platform.users.manage",
    "platform.companies.read",
    "platform.companies.manage",
    "platform.settings.manage",
    "platform.audit.view",
    "platform.proposals.manage",
    "platform.stats.view",
  ],
  platform_admin: [
    "platform.users.read",
    "platform.companies.read",
    "platform.audit.view",
    "platform.proposals.manage",
    "platform.stats.view",
  ],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "company.read": "عرض الشركة",
  "company.settings.manage": "إدارة إعدادات الشركة",
  "company.members.read": "عرض المستخدمين",
  "company.members.manage": "إدارة المستخدمين",
  "company.roles.manage": "إدارة الأدوار والصلاحيات",
  "company.branches.manage": "إدارة الفروع",
  "accounts.read": "عرض دليل الحسابات",
  "accounts.manage": "إدارة دليل الحسابات",
  "journal.read": "عرض القيود",
  "journal.create": "إنشاء قيد",
  "journal.edit_draft": "تعديل مسودة قيد",
  "journal.submit": "إرسال قيد للمراجعة",
  "journal.approve": "اعتماد قيد",
  "journal.post": "ترحيل قيد",
  "journal.reverse": "عكس قيد",
  "journal.export": "تصدير القيود",
  "imports.read": "عرض عمليات الاستيراد",
  "imports.create": "استيراد ملفات",
  "periods.read": "عرض الفترات المالية",
  "periods.close": "إغلاق فترة مالية",
  "periods.reopen": "إعادة فتح فترة مالية",
  "reports.view": "عرض التقارير",
  "reports.export": "تصدير التقارير",
  "findings.view": "عرض الاكتشافات",
  "findings.review": "مراجعة الاكتشافات",
  "audit.view": "عرض سجل التدقيق",
  "proposals.create": "تقديم مقترح تطوير",
  "proposals.view": "عرض المقترحات",
  "proposals.triage": "فرز المقترحات",
  "platform.users.read": "عرض مستخدمي المنصة",
  "platform.users.manage": "إدارة مستخدمي المنصة",
  "platform.companies.read": "عرض شركات المنصة",
  "platform.companies.manage": "إدارة شركات المنصة",
  "platform.settings.manage": "إدارة إعدادات المنصة",
  "platform.audit.view": "عرض سجل تدقيق المنصة",
  "platform.proposals.manage": "إدارة مركز التطوير",
  "platform.stats.view": "عرض إحصاءات النظام",
};

/** صلاحيات الشركة فقط (تُستخدم عند التحقق داخل نطاق شركة). */
export const COMPANY_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (permission) => !permission.startsWith("platform."),
);

export interface PermissionSubject {
  role?: CompanyRole | null;
  customPermissions?: readonly string[] | null;
  platformRole?: PlatformRole | null;
  isSuperAdmin?: boolean;
}

/**
 * قرار مركزي واحد. مبدأ الأمان: الرفض هو الافتراضي.
 * - المالك يملك كل صلاحيات شركته دائماً (لا يمكن تقييده بدور مخصص).
 * - الدور المخصص يستبدل صلاحيات الدور النظامي، لا يضاف إليها.
 * - صلاحيات المنصة لا تشمل أي كتابة في دفاتر العملاء.
 */
export function can(subject: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!subject) return false;

  if (permission.startsWith("platform.")) {
    const platformRole = subject.platformRole ?? (subject.isSuperAdmin ? "super_admin" : null);
    if (!platformRole) return false;
    return PLATFORM_ROLE_PERMISSIONS[platformRole].includes(permission);
  }

  if (!subject.role) return false;
  if (subject.role === "owner") return true;
  if (subject.customPermissions) return subject.customPermissions.includes(permission);
  return ROLE_PERMISSIONS[subject.role].includes(permission);
}

export function canAny(subject: PermissionSubject | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(subject, permission));
}

export function permissionsFor(subject: PermissionSubject | null | undefined): Permission[] {
  return PERMISSIONS.filter((permission) => can(subject, permission));
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
