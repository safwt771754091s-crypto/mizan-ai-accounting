"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { signInAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, {});

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-950">تسجيل الدخول</h1>
      <p className="mt-1.5 text-sm text-muted">أدخل بيانات حسابك للوصول إلى شركاتك وتقاريرك.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="البريد الإلكتروني" required htmlFor="email">
          <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="name@company.com" required />
        </Field>
        <Field label="كلمة المرور" required htmlFor="password">
          <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" placeholder="••••••••" required />
        </Field>

        {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
        {state.message ? <Alert variant="info">{state.message}</Alert> : null}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {pending ? "جارٍ التحقق..." : "دخول"}
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-line bg-white p-4 text-xs">
        <p className="font-bold text-ink">حسابات التجربة</p>
        <div className="mt-2 space-y-1.5 text-muted">
          <p className="flex items-center justify-between gap-3">
            <span>المحاسب / المالك</span>
            <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-brand-900">
              demo@mizan.ai / Demo1234!
            </code>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span>المراجع</span>
            <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-brand-900">
              auditor@mizan.ai / Demo1234!
            </code>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span>مشاهد</span>
            <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-brand-900">
              viewer@mizan.ai / Demo1234!
            </code>
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        لا تملك حساباً؟{" "}
        <Link href="/register" className="font-bold text-teal-700 hover:underline">
          إنشاء حساب جديد
        </Link>
      </p>
    </div>
  );
}
