import type { Metadata } from "next";
import { ShieldCheck, Trash2, Users } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { MEMBER_ROLE_LABELS } from "@/lib/data/types";
import {
  assignCustomRoleAction,
  deleteCustomRoleAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/actions/company";
import { getRepository } from "@/lib/data/repository";
import { InviteMemberForm } from "@/components/app/invite-form";
import { RoleForm } from "@/components/app/role-form";
import { AccessDenied, NoCompanyState } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/dates";
import {
  COMPANY_PERMISSIONS,
  COMPANY_ROLES,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permission-catalog";

export const metadata: Metadata = { title: "المستخدمون والصلاحيات" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="المستخدمون والصلاحيات" />
        <NoCompanyState />
      </>
    );
  }

  if (!ctx.allows("company.members.read")) {
    return (
      <>
        <PageHeader eyebrow={ctx.company.name} title="المستخدمون والصلاحيات" />
        <AccessDenied description="عرض أعضاء الشركة يتطلب صلاحية «عرض المستخدمين»." />
      </>
    );
  }

  const members = await ctx.repo.listMembers(ctx.company.id);
  const manage = ctx.allows("company.members.manage");
  const manageRoles = ctx.allows("company.roles.manage");
  const customRoles = await ctx.repo.listCustomRoles(ctx.company.id);
  const platformUsers = ctx.user.isSuperAdmin ? await getRepository().listUsers() : [];

  return (
    <>
      <PageHeader
        eyebrow={ctx.company.name}
        title="المستخدمون والصلاحيات"
        description="الصلاحيات مرتبطة بعضوية الشركة، ولا تمنح أي وصول لبيانات شركة أخرى."
        actions={<Badge variant="neutral">{members.length} عضو</Badge>}
      />

      {manage ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-700" />
              إضافة عضو
            </CardTitle>
            <CardDescription>أضف مستخدماً مسجلاً إلى هذه الشركة وحدد دوره.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm companyId={ctx.company.id} />
          </CardContent>
        </Card>
      ) : (
        <Alert variant="info" title="عرض فقط">
          إدارة الأعضاء متاحة لمن يملك صلاحية «إدارة المستخدمين». يمكنك مراجعة قائمة الأعضاء وأدوارهم.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>أعضاء الشركة</CardTitle>
            <CardDescription>تغيير الدور يسري فوراً على جميع الصفحات وواجهات API.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>المستخدم</TH>
                  <TH>البريد</TH>
                  <TH>الدور</TH>
                  <TH>دور مخصص</TH>
                  <TH>تاريخ الإضافة</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {members.map((member) => {
                  const assigned = customRoles.find((role) => role.id === member.customRoleId) ?? null;
                  return (
                    <TR key={member.id}>
                      <TD className="text-xs font-semibold">
                        {member.user.fullName}
                        {member.user.isSuperAdmin ? (
                          <Badge variant="teal" className="ms-2">مدير المنصة</Badge>
                        ) : null}
                      </TD>
                      <TD className="text-[11px] text-muted" dir="ltr">{member.user.email}</TD>
                      <TD>
                        {manage && member.role !== "owner" ? (
                          <form action={updateMemberRoleAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="companyId" value={ctx.company!.id} />
                            <input type="hidden" name="memberId" value={member.id} />
                            <Select name="role" defaultValue={member.role} className="h-8 w-32 text-[11px]">
                              {COMPANY_ROLES.filter((role) => role !== "owner").map((role) => (
                                <option key={role} value={role}>
                                  {MEMBER_ROLE_LABELS[role]}
                                </option>
                              ))}
                            </Select>
                            <Button type="submit" variant="secondary" size="sm" className="h-8 text-[10px]">
                              تحديث
                            </Button>
                          </form>
                        ) : (
                          <Badge variant={member.role === "owner" ? "default" : "neutral"}>
                            {MEMBER_ROLE_LABELS[member.role]}
                          </Badge>
                        )}
                      </TD>
                      <TD>
                        {manage && member.role !== "owner" && customRoles.length ? (
                          <form action={assignCustomRoleAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="companyId" value={ctx.company!.id} />
                            <input type="hidden" name="memberId" value={member.id} />
                            <Select name="roleId" defaultValue={assigned?.id ?? ""} className="h-8 w-32 text-[11px]">
                              <option value="">بدون</option>
                              {customRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </Select>
                            <Button type="submit" variant="secondary" size="sm" className="h-8 text-[10px]">
                              تعيين
                            </Button>
                          </form>
                        ) : assigned ? (
                          <Badge variant="teal">{assigned.name}</Badge>
                        ) : (
                          <span className="text-[10px] text-muted">—</span>
                        )}
                      </TD>
                      <TD className="text-[10px] text-muted">{formatDateShort(member.createdAt)}</TD>
                      <TD>
                        {manage && member.role !== "owner" ? (
                          <form action={removeMemberAction}>
                            <input type="hidden" name="companyId" value={ctx.company!.id} />
                            <input type="hidden" name="memberId" value={member.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-muted hover:border-danger-100 hover:bg-danger-50 hover:text-danger-600"
                            >
                              <Trash2 className="h-3 w-3" />
                              إزالة
                            </button>
                          </form>
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      {manageRoles ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              الأدوار المخصصة
            </CardTitle>
            <CardDescription>
              صلاحيات الدور المخصص تستبدل صلاحيات الدور النظامي للعضو المعيّن، ولا يمكنها تجاوز صلاحيات المالك.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RoleForm companyId={ctx.company.id} />

            {customRoles.length ? (
              <div className="space-y-2">
                {customRoles.map((role) => (
                  <div key={role.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-ink">{role.name}</p>
                        {role.description ? (
                          <p className="mt-0.5 text-[10px] text-muted">{role.description}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {role.permissions.map((permission) => (
                            <span
                              key={permission}
                              className="rounded-md bg-surface px-1.5 py-0.5 text-[9px] font-semibold text-muted"
                            >
                              {PERMISSION_LABELS[permission] ?? permission}
                            </span>
                          ))}
                        </div>
                      </div>
                      <form action={deleteCustomRoleAction}>
                        <input type="hidden" name="companyId" value={ctx.company!.id} />
                        <input type="hidden" name="roleId" value={role.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-muted hover:border-danger-100 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <Trash2 className="h-3 w-3" />
                          حذف
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted">لا توجد أدوار مخصصة بعد.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>مصفوفة الصلاحيات</CardTitle>
          <CardDescription>مولّدة من كتالوج الصلاحيات الفعلي المستخدم في التحقق على الخادم.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>الصلاحية</TH>
                  {COMPANY_ROLES.map((role) => (
                    <TH key={role}>{MEMBER_ROLE_LABELS[role]}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {COMPANY_PERMISSIONS.map((permission) => (
                  <TR key={permission}>
                    <TD className="text-[11px] font-semibold">
                      {PERMISSION_LABELS[permission]}
                      <span className="ms-1 font-mono text-[9px] text-muted" dir="ltr">{permission}</span>
                    </TD>
                    {COMPANY_ROLES.map((role) => {
                      const allowed = ROLE_PERMISSIONS[role].includes(permission);
                      return (
                        <TD key={role} className={allowed ? "text-success-600" : "text-muted"} dir="ltr">
                          {allowed ? "✓" : "—"}
                        </TD>
                      );
                    })}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      {ctx.user.isSuperAdmin ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>مستخدمو المنصة</CardTitle>
            <CardDescription>قائمة الحسابات المسجلة (مرئية لمدير المنصة فقط).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <TR>
                    <TH>الاسم</TH>
                    <TH>البريد</TH>
                    <TH>النوع</TH>
                    <TH>تاريخ الإنشاء</TH>
                  </TR>
                </THead>
                <TBody>
                  {platformUsers.map((user) => (
                    <TR key={user.id}>
                      <TD className="text-xs">{user.fullName}</TD>
                      <TD className="text-[11px] text-muted" dir="ltr">{user.email}</TD>
                      <TD>{user.isSuperAdmin ? <Badge variant="teal">مدير منصة</Badge> : <Badge variant="neutral">مستخدم</Badge>}</TD>
                      <TD className="text-[10px] text-muted">{formatDateShort(user.createdAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
