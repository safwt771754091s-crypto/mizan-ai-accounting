import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Building2, Plus, Receipt, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/data/repository";
import { MEMBER_ROLE_LABELS, COMPANY_STATUS_LABELS } from "@/lib/data/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { formatDateShort } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "الشركات" };

export default async function CompaniesPage() {
  const user = await requireUser("/companies");
  const repo = getRepository();
  const companies = await repo.listCompanies(user.id);

  return (
    <>
      <PageHeader
        eyebrow="إدارة الشركات"
        title="شركاتك"
        description="كل شركة لها دليل حسابات وقيود وفترات مالية مستقلة تماماً. لا تختلط البيانات بين الشركات."
        actions={
          <Button asChild variant="teal">
            <Link href="/companies/new">
              <Plus className="h-4 w-4" />
              شركة جديدة
            </Link>
          </Button>
        }
      />

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-teal-700">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-bold text-ink">ابدأ بإنشاء شركتك الأولى</h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted">
              أدخل بيانات النشاط والعملة والسنة المالية، ثم ارفع ملفك المحاسبي الأول.
            </p>
            <Button asChild className="mt-4">
              <Link href="/companies/new">
                <Plus className="h-4 w-4" />
                إنشاء شركة
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id} className="transition-colors hover:border-teal-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-ink">{company.name}</h2>
                    <p className="mt-0.5 truncate text-[11px] text-muted">{company.legalName}</p>
                  </div>
                  <Badge variant={company.status === "active" ? "success" : "neutral"}>
                    {COMPANY_STATUS_LABELS[company.status] ?? company.status}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-surface px-2.5 py-2">
                    <p className="text-muted">النشاط</p>
                    <p className="mt-0.5 truncate font-semibold text-ink">{company.activityType}</p>
                  </div>
                  <div className="rounded-lg bg-surface px-2.5 py-2">
                    <p className="text-muted">العملة</p>
                    <p className="mt-0.5 font-semibold text-ink" dir="ltr">{company.currency}</p>
                  </div>
                  <div className="rounded-lg bg-surface px-2.5 py-2">
                    <p className="text-muted">السنة المالية</p>
                    <p className="mt-0.5 font-semibold text-ink" dir="ltr">{company.fiscalYearStart.slice(0, 4)}</p>
                  </div>
                  <div className="rounded-lg bg-surface px-2.5 py-2">
                    <p className="text-muted">دورك</p>
                    <p className="mt-0.5 font-semibold text-ink">{MEMBER_ROLE_LABELS[company.role]}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-[10px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    {company.entryCount} قيد
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {company.memberCount} عضو
                  </span>
                  <span>أُنشئت {formatDateShort(company.createdAt)}</span>
                </div>

                <Link
                  href={`/companies/${company.id}?company=${company.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-white py-2 text-xs font-bold text-brand-800 hover:bg-surface"
                >
                  فتح الشركة
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
