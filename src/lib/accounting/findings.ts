import Decimal from "decimal.js";
import { dec, money } from "./money";
import { normalBalanceOf } from "./accounts";
import { accountBalancesAt, addDays, buildTrialBalance, entryTotals, startOfYear } from "./engine";
import type { Account, AuditFinding, DateRange, JournalEntry, Ledger, Severity } from "./types";

export interface FindingOptions extends DateRange {
  /** حد المبلغ الذي يُعتبر مستنداً مطلوباً له. */
  documentationThreshold?: number;
  /** عدد الأيام المسموح بها قبل/بعد الفترة المالية. */
  periodGraceDays?: number;
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function finding(input: Omit<AuditFinding, "id" | "detectedAt" | "status">): AuditFinding {
  return {
    ...input,
    id: nextId(input.code),
    detectedAt: new Date().toISOString(),
    status: "open",
  };
}

export function sortFindings(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0);
  });
}

export function summarizeFindings(findings: AuditFinding[]): Record<Severity, number> {
  const result: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) result[f.severity] += 1;
  return result;
}

function isUnclassified(account: Account): boolean {
  const text = `${account.name} ${account.nameEn ?? ""}`;
  return /غير مصنف|غير مصنّفة|متنوع|معلق|unknown|unclassified|suspense/i.test(text) || /^9{3,}/.test(account.code);
}

export function detectAuditFindings(
  ledger: Pick<Ledger, "accounts" | "entries" | "currency" | "periods">,
  options: FindingOptions = {},
): AuditFinding[] {
  sequence = 0;
  const findings: AuditFinding[] = [];
  const byCode = new Map<string, Account>();
  for (const account of ledger.accounts) byCode.set(account.code.trim(), account);
  const asOf = options.to ?? new Date().toISOString().slice(0, 10);
  const from = options.from ?? startOfYear(asOf);
  const documentationThreshold = dec(options.documentationThreshold ?? 5000);
  const grace = options.periodGraceDays ?? 0;

  const entries = ledger.entries.filter((e) => e.status !== "void");
  const posted = entries.filter((e) => e.status === "posted");
  const periodFrom = addDays(from, -grace);
  const periodTo = addDays(asOf, grace);

  for (const entry of entries) {
    const totals = entryTotals(entry);
    if (!totals.balanced) {
      findings.push(
        finding({
          code: "UNBALANCED_ENTRY",
          title: "قيد غير متوازن",
          description: `القيد ${entry.entryNumber} بتاريخ ${entry.date} غير متوازن: مدين ${totals.debit.toFixed(2)} مقابل دائن ${totals.credit.toFixed(2)}.`,
          severity: "critical",
          category: "balance",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: money(totals.difference),
          reason: "مجموع المدين لا يساوي مجموع الدائن في سطور القيد.",
          recommendation: "راجع سطور القيد وصحّح المبلغ أو أضف السطر الناقص، ثم أعد الترحيل.",
          confidence: 1,
          evidence: { debit: totals.debit.toFixed(2), credit: totals.credit.toFixed(2) },
        }),
      );
    }
    if (entry.lines.length === 0) {
      findings.push(
        finding({
          code: "EMPTY_ENTRY",
          title: "قيد بدون سطور",
          description: `القيد ${entry.entryNumber} لا يحتوي على أي سطور.`,
          severity: "critical",
          category: "missing_data",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: null,
          reason: "لا توجد تفاصيل محاسبية للقيد.",
          recommendation: "احذف القيد الفارغ أو أضف سطوره الصحيحة.",
          confidence: 1,
        }),
      );
    }
    if (entry.lines.length === 1) {
      findings.push(
        finding({
          code: "SINGLE_LINE_ENTRY",
          title: "قيد بسطر واحد",
          description: `القيد ${entry.entryNumber} يحتوي على سطر واحد فقط، وهو غير ممكن في القيد المزدوج.`,
          severity: "high",
          category: "posting",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: money(totals.debit),
          reason: "القيد المزدوج يتطلب طرفاً مديناً وطرفاً دائناً على الأقل.",
          recommendation: "أضف الطرف المقابل للقيد.",
          confidence: 0.95,
        }),
      );
    }
    if (!entry.date || Number.isNaN(Date.parse(entry.date))) {
      findings.push(
        finding({
          code: "INVALID_ENTRY_DATE",
          title: "تاريخ قيد غير صالح",
          description: `القيد ${entry.entryNumber} يحتوي تاريخاً مفقوداً أو غير صالح.`,
          severity: "high",
          category: "missing_data",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: null,
          reason: "لا يمكن ترحيل القيد إلى فترة صحيحة بدون تاريخ.",
          recommendation: "صحّح تاريخ القيد وفق المستند الأصلي.",
          confidence: 1,
        }),
      );
    } else if (entry.source !== "opening" && (entry.date.slice(0, 10) < periodFrom || entry.date.slice(0, 10) > periodTo)) {
      findings.push(
        finding({
          code: "ENTRY_OUTSIDE_PERIOD",
          title: "قيد خارج الفترة المالية",
          description: `القيد ${entry.entryNumber} بتاريخ ${entry.date} يقع خارج الفترة ${from} إلى ${asOf}.`,
          severity: "medium",
          category: "period",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: money(totals.debit),
          reason: "تاريخ القيد خارج حدود الفترة المالية المحددة للفحص.",
          recommendation: "تحقق من صحة التاريخ أو من تسجيل القيد في الفترة الصحيحة.",
          confidence: 0.9,
        }),
      );
    }
    if (!entry.description || entry.description.trim().length < 3) {
      findings.push(
        finding({
          code: "MISSING_DESCRIPTION",
          title: "وصف قيد مفقود",
          description: `القيد ${entry.entryNumber} لا يحتوي على وصف كافٍ.`,
          severity: "low",
          category: "documentation",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: money(totals.debit),
          reason: "الوصف ضروري لفهم طبيعة العملية وربطها بالمستند.",
          recommendation: "أضف وصفاً واضحاً يوضح طبيعة العملية والطرف المقابل.",
          confidence: 0.8,
        }),
      );
    }
    if (totals.debit.gte(documentationThreshold) && !entry.reference && !entry.lines.some((l) => l.documentRef)) {
      findings.push(
        finding({
          code: "MISSING_DOCUMENT",
          title: "عملية بمبلغ كبير بدون مرجع مستند",
          description: `القيد ${entry.entryNumber} بمبلغ ${totals.debit.toFixed(2)} لا يحتوي على رقم مستند أو مرجع.`,
          severity: "medium",
          category: "documentation",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: money(totals.debit),
          reason: "المبالغ الكبيرة تتطلب مستنداً مؤيداً قابلاً للتتبع.",
          recommendation: "أضف رقم الفاتورة أو السند أو مرجع المستند إلى القيد.",
          confidence: 0.85,
          evidence: { threshold: documentationThreshold.toFixed(2) },
        }),
      );
    }
    for (const line of entry.lines) {
      const code = line.accountCode?.trim();
      if (code && !byCode.has(code)) {
        findings.push(
          finding({
            code: "UNKNOWN_ACCOUNT",
            title: "حساب غير موجود في دليل الحسابات",
            description: `القيد ${entry.entryNumber} يستخدم الحساب ${code} غير الموجود في دليل الحسابات.`,
            severity: "high",
            category: "chart_of_accounts",
            accountCode: code,
            entryNumber: entry.entryNumber,
            entryId: entry.id,
            source: entry.source,
            amount: money(dec(line.debit).plus(line.credit)),
            reason: "استخدام حساب غير معرّف يمنع تصنيفه في القوائم المالية.",
            recommendation: "أضف الحساب إلى دليل الحسابات أو صحّح رقم الحساب في القيد.",
            confidence: 1,
          }),
        );
      }
      if (dec(line.debit).isNegative() || dec(line.credit).isNegative()) {
        findings.push(
          finding({
            code: "NEGATIVE_LINE_AMOUNT",
            title: "مبلغ سالب في سطر قيد",
            description: `السطر على الحساب ${code} في القيد ${entry.entryNumber} يحتوي مبلغاً سالباً.`,
            severity: "high",
            category: "posting",
            accountCode: code,
            entryNumber: entry.entryNumber,
            entryId: entry.id,
            source: entry.source,
            amount: money(dec(line.debit).plus(line.credit)),
            reason: "المبالغ السالبة قد تعني خطأ في الترحيل أو استخداماً غير صحيح للطرف المدين/الدائن.",
            recommendation: "استخدم الطرف المقابل بدلاً من المبلغ السالب، أو صحّح القيد.",
            confidence: 0.9,
          }),
        );
      }
    }
  }

  const byNumber = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    if (!entry.entryNumber) continue;
    const key = entry.entryNumber.trim();
    byNumber.set(key, [...(byNumber.get(key) ?? []), entry]);
  }
  for (const [number, group] of byNumber) {
    if (group.length > 1) {
      findings.push(
        finding({
          code: "DUPLICATE_ENTRY_NUMBER",
          title: "رقم قيد مكرر",
          description: `رقم القيد ${number} مستخدم في ${group.length} قيود مختلفة.`,
          severity: "high",
          category: "posting",
          entryNumber: number,
          entryId: group[0].id,
          source: group[0].source,
          amount: money(group.reduce((s, e) => s.plus(entryTotals(e).debit), new Decimal(0))),
          reason: "تكرار رقم القيد يمنع التتبع الفريد للعمليات.",
          recommendation: "أعد ترقيم القيود بشكل فريد وفق تسلسل النظام.",
          confidence: 1,
          evidence: { count: group.length },
        }),
      );
    }
  }

  const balances = accountBalancesAt(ledger, asOf);
  for (const [code, balance] of balances) {
    const account = byCode.get(code);
    if (!account || balance.net.isZero()) continue;
    const normal = normalBalanceOf(account);
    const netSide = balance.net.isPositive() ? "debit" : "credit";
    if (netSide === normal) continue;
    const absAmount = balance.net.abs();
    if (absAmount.lt(new Decimal("1"))) continue;

    let severity: Severity = "medium";
    let title = "رصيد مخالف للطبيعة";
    let reason = `الحساب من نوع ${account.type} وطبيعته ${normal === "debit" ? "مدين" : "دائن"} لكن رصيده ${netSide === "debit" ? "مدين" : "دائن"}.`;
    if (account.subtype === "cash" || account.subtype === "bank") {
      severity = "critical";
      title = "رصيد نقدي سالب";
      reason = "لا يمكن أن يكون رصيد النقدية أو البنك سالباً في الواقع؛ قد يكون هناك ترحيل خاطئ أو سحب غير مسجل.";
    } else if (account.subtype === "receivable") {
      severity = "high";
      title = "رصيد عملاء دائن";
      reason = "رصيد دائن للعملاء قد يعني دفعة مقدمة غير مصنفة أو تحصيلاً زائداً أو خطأ ترحيل.";
    } else if (account.subtype === "payable") {
      severity = "high";
      title = "رصيد موردين مدين";
      reason = "رصيد مدين للموردين قد يعني دفعة مقدمة أو سداداً زائداً أو خطأ ترحيل.";
    } else if (account.type === "revenue" && account.subtype !== "sales_returns") {
      severity = "high";
      title = "رصيد إيراد مدين";
      reason = "الإيرادات طبيعتها دائنة؛ الرصيد المدين قد يعني مردودات غير مصنفة أو قيداً معكوساً.";
    } else if (account.type === "expense") {
      title = "رصيد مصروف دائن";
      reason = "المصروفات طبيعتها مدينة؛ الرصيد الدائن قد يعني استرداداً أو تصحيحاً يحتاج إلى مراجعة.";
    } else if (account.type === "equity" && account.subtype !== "drawings") {
      title = "رصيد حقوق ملكية مدين";
      reason = "حقوق الملكية طبيعتها دائنة؛ الرصيد المدين قد يعني خسائر متراكمة أو مسحوبات غير مصنفة.";
    }

    findings.push(
      finding({
        code: "ABNORMAL_BALANCE",
        title,
        description: `الحساب ${account.code} - ${account.name} يظهر برصيد ${money(absAmount).toFixed(2)} في الاتجاه غير الطبيعي.`,
        severity,
        category: "abnormal_balance",
        accountCode: account.code,
        accountName: account.name,
        amount: money(absAmount),
        reason,
        recommendation: "راجع حركات الحساب والمستندات المؤيدة، وتأكد من تصنيف الرصيد بشكل صحيح.",
        confidence: 0.85,
        evidence: { normalBalance: normal, actualSide: netSide, net: balance.net.toFixed(2) },
      }),
    );
  }

  for (const account of ledger.accounts) {
    if (!isUnclassified(account)) continue;
    const balance = balances.get(account.code.trim());
    if (!balance || balance.net.isZero()) continue;
    findings.push(
      finding({
        code: "UNCLASSIFIED_ACCOUNT",
        title: "حساب غير مصنف برصيد قائم",
        description: `الحساب ${account.code} - ${account.name} يبدو غير مصنف ويحمل رصيداً ${money(balance.net.abs()).toFixed(2)}.`,
        severity: "high",
        category: "classification",
        accountCode: account.code,
        accountName: account.name,
        amount: money(balance.net.abs()),
        reason: "الحسابات غير المصنفة تؤثر على دقة القوائم المالية.",
        recommendation: "أعد تصنيف الرصيد إلى الحساب المناسب في دليل الحسابات.",
        confidence: 0.75,
      }),
    );
  }

  const trial = buildTrialBalance(ledger, { from, to: asOf });
  if (!trial.balanced && trial.rows.length > 0) {
    findings.push(
      finding({
        code: "TRIAL_BALANCE_DIFFERENCE",
        title: "فرق في ميزان المراجعة",
        description: `ميزان المراجعة غير متوازن بفرق ${trial.difference.toFixed(2)}.`,
        severity: "critical",
        category: "balance",
        amount: Math.abs(trial.difference),
        reason: "مجموع الأرصدة المدينة لا يساوي مجموع الأرصدة الدائنة.",
        recommendation: "ابحث عن القيود غير المتوازنة أو الأخطاء في الترحيل قبل الاعتماد على القوائم.",
        confidence: 1,
        evidence: {
          closingDebit: trial.totals.closingDebit.toFixed(2),
          closingCredit: trial.totals.closingCredit.toFixed(2),
        },
      }),
    );
  }

  if (ledger.periods?.length) {
    for (const entry of posted) {
      const day = entry.date?.slice(0, 10);
      if (!day) continue;
      const covered = ledger.periods.some((p) => day >= p.startDate && day <= p.endDate);
      if (!covered) {
        findings.push(
          finding({
            code: "ENTRY_OUTSIDE_FISCAL_PERIODS",
            title: "قيد خارج الفترات المالية المعرفة",
            description: `القيد ${entry.entryNumber} بتاريخ ${day} لا يقع ضمن أي فترة مالية معرّفة.`,
            severity: "medium",
            category: "period",
            entryNumber: entry.entryNumber,
            entryId: entry.id,
            source: entry.source,
            amount: money(entryTotals(entry).debit),
            reason: "كل قيد يجب أن يقع داخل فترة مالية مفتوحة أو مغلقة بوضوح.",
            recommendation: "أضف الفترة المالية المناسبة أو صحّح تاريخ القيد.",
            confidence: 0.9,
          }),
        );
      }
    }
  }

  for (const entry of entries) {
    const totals = entryTotals(entry);
    if (entry.lines.length > 0 && totals.debit.isZero() && totals.credit.isZero()) {
      findings.push(
        finding({
          code: "ZERO_AMOUNT_ENTRY",
          title: "قيد بمبلغ صفر",
          description: `القيد ${entry.entryNumber} لا يحتوي على أي مبالغ.`,
          severity: "low",
          category: "posting",
          entryNumber: entry.entryNumber,
          entryId: entry.id,
          source: entry.source,
          amount: 0,
          reason: "القيود الصفرية لا تؤثر على الأرصدة وقد تكون بقايا استيراد أو إدخال خاطئ.",
          recommendation: "احذف القيد إن لم يكن له أثر محاسبي.",
          confidence: 0.9,
        }),
      );
    }
  }

  return sortFindings(findings);
}
