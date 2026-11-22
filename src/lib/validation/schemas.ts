import { z } from "zod";
import { DATASET_LIST } from "@/lib/import/datasets";

export const companySchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة يجب أن يكون حرفين على الأقل").max(120),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  activityType: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().length(2, "رمز الدولة يجب أن يكون حرفين").default("SA"),
  currency: z.string().trim().length(3, "رمز العملة يجب أن يكون 3 أحرف").default("SAR"),
  fiscalYearStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ بداية السنة المالية غير صالح"),
  fiscalYearEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ نهاية السنة المالية غير صالح"),
  entityType: z.string().trim().max(80).optional().or(z.literal("")),
  taxNumber: z.string().trim().max(40).optional().or(z.literal("")),
  registrationNumber: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("بريد إلكتروني غير صالح").optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const memberSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح"),
  role: z.enum(["admin", "accountant", "auditor", "viewer"]),
});

export const importIssueSchema = z.object({
  row: z.number().int().min(0).max(100000),
  field: z.string().max(60).optional(),
  code: z.string().max(60),
  message: z.string().max(500),
  level: z.enum(["error", "warning", "info"]),
});

export const importConfirmSchema = z.object({
  companyId: z.string().min(1).max(80),
  dataset: z.enum(DATASET_LIST.map((d) => d.dataset) as [string, ...string[]]),
  fileName: z.string().min(1).max(200),
  fileKind: z.enum(["xlsx", "xls", "csv", "pdf"]),
  sizeBytes: z.number().int().min(1).max(15 * 1024 * 1024),
  checksum: z.string().min(8).max(128),
  sheetName: z.string().max(120),
  mapping: z.record(z.string().max(40), z.number().int().min(0).max(200).nullable()),
  rows: z.array(z.array(z.string().max(2000)).max(200)).max(5000),
  issues: z.array(importIssueSchema).max(5000).default([]),
  warnings: z.array(z.string().max(500)).max(200).default([]),
});

export type CompanyInput = z.infer<typeof companySchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
