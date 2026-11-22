"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCompanyPermission } from "@/lib/auth/permissions";
import { isPermission } from "@/lib/auth/permission-catalog";
import { getRepository } from "@/lib/data/repository";
import type { MemberRole } from "@/lib/data/types";
import { companySchema, fieldErrors, memberSchema } from "@/lib/validation/schemas";

export interface CompanyFormState {
  error?: string;
  errors?: Record<string, string>;
  message?: string;
}

function readCompanyForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    activityType: String(formData.get("activityType") ?? ""),
    country: String(formData.get("country") ?? "SA"),
    currency: String(formData.get("currency") ?? "SAR"),
    fiscalYearStart: String(formData.get("fiscalYearStart") ?? ""),
    fiscalYearEnd: String(formData.get("fiscalYearEnd") ?? ""),
    entityType: String(formData.get("entityType") ?? ""),
    taxNumber: String(formData.get("taxNumber") ?? ""),
    registrationNumber: String(formData.get("registrationNumber") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    city: String(formData.get("city") ?? ""),
    address: String(formData.get("address") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const user = await requireUser("/companies/new");
  const parsed = companySchema.safeParse(readCompanyForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (parsed.data.fiscalYearEnd < parsed.data.fiscalYearStart) {
    return { errors: { fiscalYearEnd: "نهاية السنة المالية يجب أن تكون بعد بدايتها." } };
  }

  try {
    const repo = getRepository();
    const company = await repo.createCompany(user.id, {
      ...parsed.data,
      legalName: parsed.data.legalName || parsed.data.name,
    });
    revalidatePath("/companies");
    revalidatePath("/dashboard");
    redirect(`/companies/${company.id}?company=${company.id}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    return { error: "تعذر إنشاء الشركة. تحقق من البيانات وحاول مرة أخرى." };
  }
}

export async function updateCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) return { error: "معرّف الشركة مفقود." };
  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, "company.settings.manage");
  if (!gate.ok) return { error: gate.error };

  const parsed = companySchema.safeParse(readCompanyForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (parsed.data.fiscalYearEnd < parsed.data.fiscalYearStart) {
    return { errors: { fiscalYearEnd: "نهاية السنة المالية يجب أن تكون بعد بدايتها." } };
  }

  const updated = await repo.updateCompany(user.id, companyId, {
    ...parsed.data,
    legalName: parsed.data.legalName || parsed.data.name,
  });
  if (!updated) return { error: "تعذر تحديث بيانات الشركة." };
  await repo.log(companyId, user.id, "update_company", "company", companyId);
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/settings");
  return { message: "تم حفظ بيانات الشركة بنجاح." };
}

export async function inviteMemberAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const user = await requireUser("/users");
  const companyId = String(formData.get("companyId") ?? "");
  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, "company.members.manage");
  if (!gate.ok) return { error: gate.error };
  const parsed = memberSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "viewer"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const result = await repo.inviteMember(companyId, parsed.data.email, parsed.data.role as MemberRole);
  if (!result.ok) return { error: result.error };
  await repo.log(companyId, user.id, "invite_member", "company_member", parsed.data.email);
  revalidatePath("/users");
  return { message: "تمت إضافة العضو." };
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const user = await requireUser("/users");
  const companyId = String(formData.get("companyId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "") as MemberRole;
  if (!["admin", "senior_accountant", "accountant", "auditor", "viewer"].includes(role)) return;
  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, "company.members.manage");
  if (!gate.ok) return;
  await repo.updateMemberRole(companyId, memberId, role);
  await repo.log(companyId, user.id, "update_member_role", "company_member", memberId, { role });
  revalidatePath("/users");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser("/users");
  const companyId = String(formData.get("companyId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, "company.members.manage");
  if (!gate.ok) return;
  await repo.removeMember(companyId, memberId);
  await repo.log(companyId, user.id, "remove_member", "company_member", memberId);
  revalidatePath("/users");
}

const findingStatusSchema = z.object({
  companyId: z.string().min(1),
  findingId: z.string().min(1),
  status: z.enum(["open", "reviewed", "dismissed"]),
  note: z.string().max(500).optional(),
  returnTo: z.string().max(200).optional(),
});

export async function setFindingStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser("/findings");
  const parsed = findingStatusSchema.safeParse({
    companyId: String(formData.get("companyId") ?? ""),
    findingId: String(formData.get("findingId") ?? ""),
    status: String(formData.get("status") ?? "open"),
    note: String(formData.get("note") ?? "") || undefined,
    returnTo: String(formData.get("returnTo") ?? "") || undefined,
  });
  if (!parsed.success) return;
  const repo = getRepository();
  const gate = await assertCompanyPermission(user, parsed.data.companyId, "findings.review");
  if (!gate.ok) return;
  await repo.setFindingStatus(parsed.data.companyId, user.id, parsed.data.findingId, parsed.data.status, parsed.data.note);
  revalidatePath("/findings");
  revalidatePath("/dashboard");
  revalidatePath(parsed.data.returnTo ?? "/findings");
}

const customRoleSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(2).max(60),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).default([]),
});

export async function createCustomRoleAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const user = await requireUser("/users");
  const parsed = customRoleSchema.safeParse({
    companyId: String(formData.get("companyId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    permissions: formData.getAll("permissions").map(String),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const gate = await assertCompanyPermission(user, parsed.data.companyId, "company.roles.manage");
  if (!gate.ok) return { error: gate.error };

  const permissions = parsed.data.permissions.filter(isPermission);
  if (!permissions.length) return { error: "اختر صلاحية واحدة على الأقل للدور." };

  const repo = getRepository();
  const result = await repo.createCustomRole(parsed.data.companyId, user.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    permissions,
  });
  if (!result.ok) return { error: result.error };
  await repo.log(parsed.data.companyId, user.id, "create_role", "role", result.role?.id, {
    name: parsed.data.name,
    permissions: permissions.join(","),
  });
  revalidatePath("/users");
  return { message: "تم إنشاء الدور المخصص." };
}

export async function deleteCustomRoleAction(formData: FormData): Promise<void> {
  const user = await requireUser("/users");
  const companyId = String(formData.get("companyId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!companyId || !roleId) return;
  const gate = await assertCompanyPermission(user, companyId, "company.roles.manage");
  if (!gate.ok) return;
  const repo = getRepository();
  const result = await repo.deleteCustomRole(companyId, roleId);
  if (result.ok) await repo.log(companyId, user.id, "delete_role", "role", roleId);
  revalidatePath("/users");
}

export async function assignCustomRoleAction(formData: FormData): Promise<void> {
  const user = await requireUser("/users");
  const companyId = String(formData.get("companyId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!companyId || !memberId) return;
  const gate = await assertCompanyPermission(user, companyId, "company.members.manage");
  if (!gate.ok) return;
  const repo = getRepository();
  const result = await repo.setMemberCustomRole(companyId, memberId, roleId || null);
  if (result.ok) {
    await repo.log(companyId, user.id, "assign_custom_role", "company_member", memberId, {
      roleId: roleId || "none",
    });
  }
  revalidatePath("/users");
}
