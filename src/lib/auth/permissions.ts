import { getRepository } from "@/lib/data/repository";
import type { AppUser } from "@/lib/data/types";
import type { CompanyAccess } from "@/lib/data/repository";
import type { CompanyRole, Permission, PermissionSubject, PlatformRole } from "./permission-catalog";
import { can, permissionsFor } from "./permission-catalog";

export interface CompanyPermissionState {
  access: CompanyAccess;
  subject: PermissionSubject;
  permissions: Permission[];
  allows: (permission: Permission) => boolean;
}

export function platformRoleOf(user: AppUser): PlatformRole | null {
  return user.isSuperAdmin ? "super_admin" : null;
}

export function subjectFor(
  user: AppUser,
  role: CompanyRole | null,
  customPermissions?: readonly string[] | null,
): PermissionSubject {
  return {
    role,
    customPermissions: role === "owner" ? null : (customPermissions ?? null),
    platformRole: platformRoleOf(user),
    isSuperAdmin: user.isSuperAdmin,
  };
}

/**
 * يحدد صلاحيات المستخدم داخل شركة واحدة انطلاقاً من العضوية في قاعدة البيانات.
 * لا يثق بأي companyId قادم من المتصفح: العضوية نفسها هي مصدر النطاق.
 */
export async function resolveCompanyPermission(
  user: AppUser,
  companyId: string,
): Promise<CompanyPermissionState | null> {
  const repo = getRepository();
  const access = await repo.getCompanyAccess(user.id, companyId);
  if (!access) return null;

  const customRole = access.role === "owner" ? null : await repo.getMemberCustomRole(user.id, companyId);
  const subject = subjectFor(user, access.role, customRole?.permissions ?? null);
  return {
    access,
    subject,
    permissions: permissionsFor(subject),
    allows: (permission: Permission) => can(subject, permission),
  };
}

export type PermissionDenial = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type PermissionGrant = {
  ok: true;
  state: CompanyPermissionState;
};

export type PermissionCheck = PermissionGrant | PermissionDenial;

/**
 * بوابة واحدة تُستدعى من كل مسار خادم (route handler / server action).
 * ترجع 401 لغير المسجلين و403 لغير المصرح لهم، ولا تكشف وجود الشركة لمن لا يملكها.
 */
export async function assertCompanyPermission(
  user: AppUser | null,
  companyId: string,
  permission: Permission,
): Promise<PermissionCheck> {
  if (!user) return { ok: false, status: 401, error: "غير مصرح." };
  if (!companyId) return { ok: false, status: 403, error: "الشركة غير محددة." };

  const state = await resolveCompanyPermission(user, companyId);
  if (!state) {
    return { ok: false, status: 403, error: "لا تملك صلاحية الوصول إلى هذه الشركة." };
  }
  if (!state.allows(permission)) {
    return { ok: false, status: 403, error: "دورك الحالي لا يسمح بهذه العملية." };
  }
  return { ok: true, state };
}
