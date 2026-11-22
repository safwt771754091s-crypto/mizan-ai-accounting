import { expect, type Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@rakaz.ai";
export const DEMO_PASSWORD = "Demo1234!";

export async function login(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export function uniqueEntryNumber(prefix = "E2E") {
  return `${prefix}-${Date.now().toString().slice(-8)}`;
}
