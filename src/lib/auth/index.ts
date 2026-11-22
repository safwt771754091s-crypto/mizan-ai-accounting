import { redirect } from "next/navigation";
import { dataMode } from "../supabase/config";
import { createSupabaseServerClient } from "../supabase/server";
import { readStore, mutateStore } from "../data/store";
import { hashPassword, passwordIssues, verifyPassword } from "./password";
import { createDemoSession, destroyDemoSession, readDemoSession } from "./session";
import type { AppUser } from "../data/types";

export interface AuthResult {
  ok: boolean;
  error?: string;
  message?: string;
  needsEmailConfirmation?: boolean;
}

function toAppUser(user: {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  createdAt: string;
}): AppUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (dataMode() === "demo") {
    const userId = await readDemoSession();
    if (!userId) return null;
    const store = await readStore();
    const user = store.users.find((u) => u.id === userId);
    return user ? toAppUser(user) : null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const metadata = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: String(metadata.full_name ?? metadata.name ?? data.user.email ?? "مستخدم"),
    isSuperAdmin: data.user.app_metadata?.role === "super_admin",
    createdAt: data.user.created_at ?? new Date().toISOString(),
  };
}

export async function requireUser(nextPath = "/dashboard"): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return { ok: false, error: "أدخل البريد الإلكتروني وكلمة المرور." };

  if (dataMode() === "demo") {
    const store = await readStore();
    const user = store.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) return { ok: false, error: "بيانات الدخول غير صحيحة." };
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { ok: false, error: "بيانات الدخول غير صحيحة." };
    await createDemoSession(user.id);
    return { ok: true };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { ok: false, error: "يلزم تأكيد البريد الإلكتروني قبل تسجيل الدخول." };
    }
    return { ok: false, error: "بيانات الدخول غير صحيحة." };
  }
  return { ok: true };
}

export async function signUpAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "البريد الإلكتروني غير صالح." };
  if (fullName.length < 3) return { ok: false, error: "أدخل الاسم الكامل (3 أحرف على الأقل)." };
  const issues = passwordIssues(input.password);
  if (issues.length) return { ok: false, error: issues.join(" ") };

  if (dataMode() === "demo") {
    const store = await readStore();
    if (store.users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: "يوجد حساب مسجل بهذا البريد الإلكتروني." };
    }
    const passwordHash = await hashPassword(input.password);
    const user = await mutateStore((s) => {
      const created = {
        id: `user-${Date.now().toString(36)}`,
        email,
        fullName,
        isSuperAdmin: false,
        createdAt: new Date().toISOString(),
        passwordHash,
      };
      s.users.push(created);
      return created;
    });
    await createDemoSession(user.id);
    return { ok: true };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { ok: false, error: "تعذر إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى." };
  if (!data.session) {
    return { ok: true, needsEmailConfirmation: true, message: "تم إنشاء الحساب. تحقق من بريدك لتأكيد الحساب." };
  }
  return { ok: true };
}

export async function signOutAccount(): Promise<void> {
  if (dataMode() === "demo") {
    await destroyDemoSession();
    return;
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
