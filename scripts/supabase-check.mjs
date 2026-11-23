#!/usr/bin/env node
/**
 * فحص ربط Supabase قبل تشغيل المنصة على قاعدة حقيقية.
 * التشغيل: npm run db:check
 * لا يطبع أي مفتاح؛ يطبع فقط نعم/لا وعدد الصفوف المرئية.
 */
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const name = trimmed.slice(0, index).trim();
    if (process.env[name] !== undefined) continue;
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const mode = (process.env.RAKAZ_DATA_MODE ?? "").trim();

const TABLES = [
  "profiles",
  "companies",
  "company_members",
  "accounting_periods",
  "accounts",
  "journal_entries",
  "journal_entry_lines",
  "uploaded_files",
  "import_batches",
  "imported_records",
  "audit_findings",
  "duplicate_findings",
  "financial_reports",
  "analysis_results",
  "activity_logs",
  "roles",
  "role_permissions",
  "user_roles",
  "audit_logs",
  "proposals",
];

const ok = (text) => console.log(`  ✅ ${text}`);
const bad = (text) => console.log(`  ❌ ${text}`);
const warn = (text) => console.log(`  ⚠️  ${text}`);

let failures = 0;

if (!url) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL غير مضبوط.");
  console.log("   أضِفه في .env.local بهذه الصيغة: https://<project-ref>.supabase.co");
  process.exit(1);
}
if (!key) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY غير مضبوط (المفتاح القابل للنشر).");
  process.exit(1);
}
if (mode && mode !== "supabase") {
  warn(`RAKAZ_DATA_MODE=${mode} — سيعمل التطبيق بوضع demo وليس Supabase.`);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const host = new URL(url).host;

console.log(`\n🔗 المشروع: ${host}\n`);

async function get(pathname) {
  const response = await fetch(`${url}${pathname}`, { headers, signal: AbortSignal.timeout(15000) });
  return response;
}

try {
  const health = await get("/auth/v1/health");
  if (health.ok) ok("خدمة المصادقة تستجيب");
  else bad(`خدمة المصادقة: HTTP ${health.status}`);
  if (!health.ok) failures += 1;
} catch (error) {
  bad(`تعذر الوصول إلى ${host}: ${error.message}`);
  process.exit(1);
}

// جذر /rest/v1/ يتطلب مفتاحاً سرّياً بطبيعته، لذا نتحقق من المفتاح عبر إعدادات المصادقة.
try {
  const settings = await get("/auth/v1/settings");
  if (settings.ok) {
    ok("المفتاح القابل للنشر مقبول");
  } else {
    bad(`المفتاح مرفوض: HTTP ${settings.status}`);
    failures += 1;
  }
} catch (error) {
  bad(`تعذر التحقق من المفتاح: ${error.message}`);
  failures += 1;
}

console.log("\n📋 الجداول:");
const missing = [];
for (const table of TABLES) {
  try {
    const response = await get(`/rest/v1/${table}?select=*&limit=1`);
    if (response.status === 200) {
      ok(table);
    } else if (response.status === 404 || response.status === 400) {
      const body = await response.text();
      if (/does not exist|42P01|PGRST205|schema cache/i.test(body)) {
        bad(`${table} — غير موجود (الترحيلات لم تُشغَّل)`);
        missing.push(table);
      } else {
        warn(`${table} — HTTP ${response.status}`);
      }
    } else if (response.status === 401 || response.status === 403) {
      warn(`${table} — مقبول لكن RLS تمنع القراءة المجهولة (متوقع)`);
    } else {
      warn(`${table} — HTTP ${response.status}`);
    }
  } catch (error) {
    warn(`${table} — ${error.message}`);
  }
}

if (missing.length) failures += 1;

console.log("");
if (failures === 0) {
  console.log("✅ الربط سليم. الخطوة التالية: شغّل اختبار العزل ثم المنصة.");
  console.log("   psql \"$SUPABASE_DB_URL\" -f supabase/tests/rls_permissions.sql");
} else {
  console.log("❌ الربط غير مكتمل. راجع ما سبق قبل تشغيل المنصة.");
  if (missing.length) {
    console.log("   نفّذ الترحيلات بالترتيب من supabase/migrations/0001 … 0007 في SQL Editor.");
  }
}
process.exit(failures === 0 ? 0 : 1);
