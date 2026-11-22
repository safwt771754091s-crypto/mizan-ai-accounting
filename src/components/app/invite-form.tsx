"use client";

import { useActionState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { inviteMemberAction, type CompanyFormState } from "@/app/actions/company";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

export function InviteMemberForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(inviteMemberAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.message ? <Alert variant="success">{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
        <Field label="البريد الإلكتروني" htmlFor="member-email">
          <Input id="member-email" name="email" type="email" dir="ltr" placeholder="user@company.com" required />
        </Field>
        <Field label="الدور" htmlFor="member-role">
          <Select id="member-role" name="role" defaultValue="viewer">
            <option value="admin">مدير</option>
            <option value="accountant">محاسب</option>
            <option value="auditor">مراجع</option>
            <option value="viewer">مشاهد</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            إضافة
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted">يجب أن يكون المستخدم قد أنشأ حساباً مسبقاً بنفس البريد.</p>
    </form>
  );
}
