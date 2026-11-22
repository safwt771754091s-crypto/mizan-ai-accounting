"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signInWithPassword, signOutAccount, signUpAccount } from "@/lib/auth";

export interface AuthFormState {
  error?: string;
  message?: string;
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  const result = await signInWithPassword(email, password);
  if (!result.ok) return { error: result.error ?? "تعذر تسجيل الدخول." };
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = await signUpAccount({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
  });
  if (!result.ok) return { error: result.error ?? "تعذر إنشاء الحساب." };
  if (result.needsEmailConfirmation) return { message: result.message };
  revalidatePath("/", "layout");
  redirect("/companies/new");
}

export async function signOutAction(): Promise<void> {
  await signOutAccount();
  revalidatePath("/", "layout");
  redirect("/login");
}
