import type { Metadata } from "next";
import { Trash2, Users } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { canManageUsers, MEMBER_ROLE_LABELS } from "@/lib/data/types";
import { removeMemberAction, updateMemberRoleAction } from "@/app/actions/company";
import { getRepository } from "@/lib/data/repository";
import { InviteMemberForm } from "@/components/app/invite-form";
import { NoCompanyState } from "@/components/app/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/dates";

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

  const members = await ctx.repo.listMembers(ctx.company.id);
  const manage = canManageUsers(ctx.role ?? "viewer");
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
          إدارة الأعضاء متاحة للمالك أو المدير. يمكنك مراجعة قائمة الأعضاء وأدوارهم.
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
                  <TH>تاريخ الإضافة</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {members.map((member) => (
                  <TR key={member.id}>
                    <TD className="text-xs font-semibold">
                      {member.user.fullName}
                      {member.user.isSuperAdmin ? <Badge variant="teal" className="ms-2">مدير المنصة</Badge> : null}
                    </TD>
                    <TD className="text-[11px] text-muted" dir="ltr">{member.user.email}</TD>
                    <TD>
                      {manage && member.role !== "owner" ? (
                        <form action={updateMemberRoleAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="companyId" value={ctx.company!.id} />
                          <input type="hidden" name="memberId" value={member.id} />
                          <Select name="role" defaultValue={member.role} className="h-8 w-28 text-[11px]">
                            <option value="admin">مدير</option>
                            <option value="accountant">محاسب</option>
                            <option value="auditor">مراجع</option>
                            <option value="viewer">مشاهد</option>
                          </Select>
                          <Button type="submit" variant="secondary" size="sm" className="h-8 text-[10px]">تحديث</Button>
                        </form>
                      ) : (
                        <Badge variant={member.role === "owner" ? "default" : "neutral"}>
                          {MEMBER_ROLE_LABELS[member.role]}
                        </Badge>
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
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>مصفوفة الصلاحيات</CardTitle>
          <CardDescription>ما يمكن لكل دور فعله داخل الشركة.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>الصلاحية</TH>
                  <TH>مالك</TH>
                  <TH>مدير</TH>
                  <TH>محاسب</TH>
                  <TH>مراجع</TH>
                  <TH>مشاهد</TH>
                </TR>
              </THead>
              <TBody>
                {[
                  { label: "قراءة البيانات والتقارير", values: [true, true, true, true, true] },
                  { label: "رفع الملفات والاستيراد", values: [true, true, true, false, false] },
                  { label: "تعديل بيانات الشركة", values: [true, true, true, false, false] },
                  { label: "مراجعة الملاحظات", values: [true, true, true, true, false] },
                  { label: "إدارة الأعضاء والصلاحيات", values: [true, true, false, false, false] },
                  { label: "إعادة تعيين بيانات العرض", values: [false, false, false, false, false] },
                ].map((row) => (
                  <TR key={row.label}>
                    <TD className="text-[11px] font-semibold">{row.label}</TD>
                    {row.values.map((value, index) => (
                      <TD key={index} className={value ? "text-success-600" : "text-muted"} dir="ltr">
                        {value ? "✓" : "—"}
                      </TD>
                    ))}
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
