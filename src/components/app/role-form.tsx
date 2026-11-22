"use client";

import { useActionState } from "react";
import { Loader2, ShieldPlus } from "lucide-react";
import { createCustomRoleAction, type CompanyFormState } from "@/app/actions/company";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { Permission } from "@/lib/auth/permission-catalog";
import { PERMISSION_LABELS } from "@/lib/auth/permission-catalog";

const GROUPS: Array<{ title: string; permissions: Permission[] }> = [
  {
    title: "الشركة والعضوية",
    permissions: [
      "company.read",
      "company.settings.manage",
      "company.members.read",
      "company.members.manage",
      "company.branches.manage",
    ],
  },
  {
    title: "المحاسبة",
    permissions: [
      "accounts.read",
      "accounts.manage",
      "journal.read",
      "journal.create",
      "journal.edit_draft",
      "journal.submit",
      "journal.post",
      "journal.reverse",
      "journal.export",
      "imports.read",
      "imports.create",
      "periods.read",
      "periods.close",
    ],
  },
  {
    title: "التقارير والمراجعة",
    permissions: ["reports.view", "reports.export", "findings.view", "findings.review", "audit.view"],
  },
];

export function RoleForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(createCustomRoleAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.message ? <Alert variant="success">{state.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم الدور" htmlFor="role-name">
          <Input id="role-name" name="name" placeholder="مثال: محاسب فروع" required minLength={2} maxLength={60} />
        </Field>
        <Field label="وصف مختصر" htmlFor="role-description">
          <Input id="role-description" name="description" maxLength={200} placeholder="اختياري" />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl border border-line p-3">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 text-[11px] font-bold text-ink">{group.title}</p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {group.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 text-[11px] text-muted">
                  <input type="checkbox" name="permissions" value={permission} className="h-3.5 w-3.5 accent-teal-700" />
                  {PERMISSION_LABELS[permission]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
        إنشاء الدور
      </Button>
    </form>
  );
}
