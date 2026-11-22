"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { signUpAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/input";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-950">إنشاء حساب جديد</h1>
      <p className="mt-1.5 text-sm text-muted">أنشئ حسابك ثم أضف شركتك الأولى وابدأ التحليل.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <Field label="الاسم الكامل" required htmlFor="fullName">
          <Input id="fullName" name="fullName" autoComplete="name" placeholder="مثال: أحمد المحاسب" required />
        </Field>
        <Field label="البريد الإلكتروني" required htmlFor="email">
          <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="name@company.com" required />
        </Field>
        <Field
          label="كلمة المرور"
          required
          htmlFor="password"
          hint="8 أحرف على الأقل، وتحتوي على حرف ورقم."
        >
          <Input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" placeholder="••••••••" required />
        </Field>

        {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
        {state.message ? <Alert variant="info">{state.message}</Alert> : null}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {pending ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        لديك حساب؟{" "}
        <Link href="/login" className="font-bold text-teal-700 hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
