#!/usr/bin/env node
/**
 * فحص اتصال مزود الذكاء الاصطناعي المستخدم في المساعد.
 * التشغيل: npm run ai:check
 * لا يطبع المفتاح إطلاقاً.
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

const key = (process.env.AI_PROVIDER_API_KEY ?? process.env.AI_API_KEY ?? "").trim();
const baseUrl = (process.env.AI_PROVIDER_BASE_URL ?? "https://api.openai.com/v1").trim().replace(/\/+$/, "");
const model = (process.env.AI_MODEL ?? "gpt-4.1-mini").trim();
const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 20000);

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

if (!key) {
  console.error("✖ لا يوجد مفتاح. اضبط AI_PROVIDER_API_KEY في .env.local أو في متغيرات Vercel.");
  console.error("  راجع docs/ai.md لخطوات الإعداد.");
  process.exit(1);
}

console.log(`• المزود: ${hostOf(baseUrl)}`);
console.log(`• النموذج: ${model}`);
console.log("• جارٍ إرسال طلب تجريبي (حد أقصى 16 رمزاً)...");

const started = Date.now();
try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 16,
      messages: [
        { role: "system", content: "أجب بكلمة واحدة فقط." },
        { role: "user", content: "قل: جاهز" },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const latency = Date.now() - started;
  const raw = await response.text();

  if (!response.ok) {
    let detail = "";
    try {
      detail = JSON.parse(raw)?.error?.message ?? "";
    } catch {
      detail = raw.slice(0, 160);
    }
    console.error(`✖ فشل الاتصال: HTTP ${response.status} (${latency}ms)${detail ? ` — ${detail}` : ""}`);
    if (response.status === 401 || response.status === 403) {
      console.error("  المفتاح غير صالح أو لا يملك صلاحية على هذا النموذج.");
    } else if (response.status === 404) {
      console.error("  تحقق من AI_PROVIDER_BASE_URL وAI_MODEL.");
    } else if (response.status === 429) {
      console.error("  تجاوزت حد الطلبات أو الرصيد.");
    }
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const content = payload?.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => part?.text ?? "").join("")
        : "";
  console.log(`✔ نجح الاتصال (${latency}ms).`);
  console.log(`• رد النموذج: ${text.trim().slice(0, 80) || "(فارغ)"}`);
  console.log("• المساعد سيستخدم هذا المزود تلقائياً بعد إعادة تشغيل الخادم.");
} catch (error) {
  const latency = Date.now() - started;
  if (error?.name === "TimeoutError") {
    console.error(`✖ انتهت المهلة بعد ${latency}ms. ارفع AI_TIMEOUT_MS أو تحقق من الشبكة.`);
  } else {
    console.error(`✖ تعذر الاتصال (${latency}ms): ${error?.message ?? error}`);
  }
  process.exit(1);
}
