<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RAKAZ AI — دليل العمل داخل المستودع

## ما هذا المشروع

منصة محاسبية عربية (RTL) مبنية على Next.js 16 App Router. المحرك المحاسبي في
`src/lib/accounting/` منفصل تماماً عن الواجهة وقاعدة البيانات، ويُستخدم في الصفحات
والتقارير والمساعد الذكي.

## الأوامر

```bash
npm run dev          # تطوير
npm run build        # بناء الإنتاج
npm run lint         # ESLint flat config
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run test:e2e     # Playwright (خادم على 3100)
npm run db:seed      # إعادة بناء البيانات التجريبية
```

قبل أي commit يجب أن تنجح: `lint` و`typecheck` و`test` و`build`. شغّل `test:e2e` عند
تغيير الواجهة أو مسارات API.

## قواعد الكود

- كل حساب مالي عبر `Decimal` (`src/lib/accounting/money.ts`). لا `+`/`*` على مبالغ خام.
- المحرك دوال نقية: لا استيراد لـ React أو Supabase داخله.
- التحقق من المدخلات بـ Zod في `src/lib/validation/`.
- كل صفحة داخل `(app)` تحصل على السياق من `loadCompanyContext` ولا تقرأ الشركة من
  المتغيرات مباشرة.
- أي مسار API جديد يتحقق من الجلسة والعضوية والدور قبل العمل.
- الواجهة عربية RTL؛ الأرقام المالية عبر مكوّن `Money` مع `dir="ltr"` عند الحاجة.
- لا تعليقات تشرح الكود؛ فقط القرارات غير البديهية.

## البيانات

- الوضع الافتراضي Demo: `.rakaz-data/demo-store.json` (مستثنى من Git).
  القراءة تتحقق من بصمة الملف، والكتابة تُسلسل — لا تُلغِ هذا السلوك.
- وضع Supabase: `RAKAZ_DATA_MODE=supabase` مع متغيرات `NEXT_PUBLIC_SUPABASE_*`.
- لا تُضف بيانات عملاء حقيقية إلى الاختبارات أو البيانات التجريبية.

## الأمن

- لا أسرار في الكود أو `.env.example` أو الاختبارات. `.env.local` فقط.
- لا تضع `SUPABASE_SERVICE_ROLE_KEY` في أي كود يعمل في المتصفح.
- استيراد الملفات: تحقق من الامتداد والتوقيع الفعلي والحجم والبصمة قبل أي معالجة.
- المساعد لا يكتب بيانات ولا يحسب أرقاماً؛ يستقبل نتائج المحرك فقط.

## التوثيق

عند تغيير قواعد محاسبية أو مخطط قاعدة البيانات أو سياسات الأمن، حدّث الملف المناسب في
`docs/` مع الكود في نفس الـ commit.
