import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/data/repository";
import { buildAssistantContext } from "@/lib/ai/context";
import { askAssistant } from "@/lib/ai/agent";
import { isAiConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const maxDuration = 45;

const requestSchema = z.object({
  companyId: z.string().min(1).max(80),
  question: z.string().trim().min(2, "السؤال قصير جداً").max(600, "السؤال طويل جداً"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "غير مصرح." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "صيغة الطلب غير صالحة." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." },
      { status: 400 },
    );
  }

  const { companyId, question } = parsed.data;
  const repo = getRepository();
  const access = await repo.getCompanyAccess(user.id, companyId);
  if (!access) return NextResponse.json({ ok: false, error: "لا تملك صلاحية الوصول إلى هذه الشركة." }, { status: 403 });

  const company = access.company;
  const period = {
    from: parsed.data.from ?? company.fiscalYearStart,
    to: parsed.data.to ?? company.fiscalYearEnd,
  };
  const data = await repo.getCompanyData(company.id);
  const context = buildAssistantContext({
    company,
    data,
    ledger: { accounts: data.accounts, entries: data.entries, periods: data.periods, currency: company.currency },
    period,
  });

  const result = await askAssistant(question, context);

  await repo.log(company.id, user.id, "assistant_query", "assistant", undefined, {
    mode: result.mode,
    questionLength: question.length,
  });

  return NextResponse.json({
    ok: true,
    answer: result.answer,
    mode: result.mode,
    sources: result.sources,
    fallbackReason: result.fallbackReason ?? null,
    aiConfigured: isAiConfigured(),
    company: { id: company.id, name: company.name, currency: company.currency },
    period,
  });
}
