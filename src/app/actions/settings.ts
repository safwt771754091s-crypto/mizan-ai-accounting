"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dataMode } from "@/lib/supabase/config";
import { resetStore } from "@/lib/data/store";

export interface SettingsState {
  error?: string;
  message?: string;
}

export async function resetDemoDataAction(_prev: SettingsState, _formData: FormData): Promise<SettingsState> {
  const user = await requireUser("/settings");
  if (dataMode() !== "demo") {
    return { error: "إعادة التعيين متاحة في وضع العرض التجريبي فقط." };
  }
  if (!user.isSuperAdmin) {
    return { error: "إعادة تعيين بيانات العرض التجريبي متاحة لمدير المنصة فقط." };
  }
  await resetStore();
  revalidatePath("/", "layout");
  return { message: "تمت إعادة تعيين بيانات العرض التجريبي إلى الحالة الأصلية." };
}
