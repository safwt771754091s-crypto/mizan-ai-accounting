"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { createCompanyAction, updateCompanyAction, type CompanyFormState } from "@/app/actions/company";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Company } from "@/lib/data/types";

const COUNTRIES = [
  { code: "SA", name: "السعودية" },
  { code: "AE", name: "الإمارات" },
  { code: "KW", name: "الكويت" },
  { code: "QA", name: "قطر" },
  { code: "BH", name: "البحرين" },
  { code: "OM", name: "عمان" },
  { code: "JO", name: "الأردن" },
  { code: "EG", name: "مصر" },
  { code: "YE", name: "اليمن" },
  { code: "IQ", name: "العراق" },
  { code: "LY", name: "ليبيا" },
  { code: "TN", name: "تونس" },
  { code: "DZ", name: "الجزائر" },
  { code: "MA", name: "المغرب" },
];

const CURRENCIES = ["SAR", "AED", "KWD", "QAR", "BHD", "OMR", "JOD", "EGP", "YER", "IQD", "USD", "EUR", "GBP"];

const ENTITY_TYPES = [
  "شركة ذات مسؤولية محدودة",
  "شركة مساهمة",
  "مؤسسة فردية",
  "شركة تضامن",
  "فرع شركة أجنبية",
  "منشأة غير ربحية",
];

const ACTIVITIES = [
  "تجارة التجزئة",
  "تجارة الجملة",
  "تجارة التجزئة والجملة",
  "مقاولات وإنشاءات",
  "خدمات مهنية",
  "مطاعم وكافيهات",
  "صناعة وتحويل",
  "نقل وخدمات لوجستية",
  "عقارات",
  "تقنية معلومات",
];

export function CompanyForm({ company }: { company?: Company }) {
  const action = company ? updateCompanyAction : createCompanyAction;
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(action, {});
  const errors = state.errors ?? {};
  const currentYear = new Date().getFullYear();

  return (
    <form action={formAction} className="space-y-5">
      {company ? <input type="hidden" name="companyId" value={company.id} /> : null}

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.message ? <Alert variant="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الشركة التجاري" required error={errors.name} htmlFor="name">
          <Input id="name" name="name" defaultValue={company?.name} placeholder="مثال: شركة النخيل للتجارة" required />
        </Field>
        <Field label="الاسم القانوني" error={errors.legalName} htmlFor="legalName" hint="كما هو في السجل التجاري.">
          <Input id="legalName" name="legalName" defaultValue={company?.legalName} placeholder="شركة النخيل للتجارة المحدودة" />
        </Field>
        <Field label="نوع النشاط" error={errors.activityType} htmlFor="activityType">
          <Select id="activityType" name="activityType" defaultValue={company?.activityType ?? ""}>
            <option value="">اختر النشاط</option>
            {ACTIVITIES.map((activity) => (
              <option key={activity} value={activity}>
                {activity}
              </option>
            ))}
            {company?.activityType && !ACTIVITIES.includes(company.activityType) ? (
              <option value={company.activityType}>{company.activityType}</option>
            ) : null}
          </Select>
        </Field>
        <Field label="نوع المنشأة" error={errors.entityType} htmlFor="entityType">
          <Select id="entityType" name="entityType" defaultValue={company?.entityType ?? ENTITY_TYPES[0]}>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الدولة" error={errors.country} htmlFor="country">
          <Select id="country" name="country" defaultValue={company?.country ?? "SA"}>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="العملة" error={errors.currency} htmlFor="currency" hint="عملة القوائم المالية الأساسية.">
          <Select id="currency" name="currency" defaultValue={company?.currency ?? "SAR"}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="بداية السنة المالية" required error={errors.fiscalYearStart} htmlFor="fiscalYearStart">
          <Input
            id="fiscalYearStart"
            name="fiscalYearStart"
            type="date"
            defaultValue={company?.fiscalYearStart ?? `${currentYear}-01-01`}
            required
          />
        </Field>
        <Field label="نهاية السنة المالية" required error={errors.fiscalYearEnd} htmlFor="fiscalYearEnd">
          <Input
            id="fiscalYearEnd"
            name="fiscalYearEnd"
            type="date"
            defaultValue={company?.fiscalYearEnd ?? `${currentYear}-12-31`}
            required
          />
        </Field>
        <Field label="الرقم الضريبي" error={errors.taxNumber} htmlFor="taxNumber">
          <Input id="taxNumber" name="taxNumber" dir="ltr" defaultValue={company?.taxNumber ?? ""} placeholder="300123456700003" />
        </Field>
        <Field label="رقم السجل التجاري" error={errors.registrationNumber} htmlFor="registrationNumber">
          <Input id="registrationNumber" name="registrationNumber" dir="ltr" defaultValue={company?.registrationNumber ?? ""} />
        </Field>
        <Field label="الهاتف" error={errors.phone} htmlFor="phone">
          <Input id="phone" name="phone" dir="ltr" defaultValue={company?.phone ?? ""} />
        </Field>
        <Field label="البريد الإلكتروني" error={errors.email} htmlFor="email">
          <Input id="email" name="email" type="email" dir="ltr" defaultValue={company?.email ?? ""} />
        </Field>
        <Field label="المدينة" error={errors.city} htmlFor="city">
          <Input id="city" name="city" defaultValue={company?.city ?? ""} />
        </Field>
        <Field label="العنوان" error={errors.address} htmlFor="address">
          <Input id="address" name="address" defaultValue={company?.address ?? ""} />
        </Field>
      </div>

      <Field label="ملاحظات" error={errors.notes} htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={company?.notes ?? ""} placeholder="معلومات إضافية عن الشركة أو نطاق العمل..." />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "جارٍ الحفظ..." : company ? "حفظ التعديلات" : "إنشاء الشركة"}
        </Button>
      </div>
    </form>
  );
}
