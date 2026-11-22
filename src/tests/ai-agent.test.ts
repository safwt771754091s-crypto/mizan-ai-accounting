import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildDemoCompanies, buildDemoData } from "@/lib/data/demo-data";
import { buildAssistantContext } from "@/lib/ai/context";
import { askAssistant } from "@/lib/ai/agent";
import type { Ledger } from "@/lib/accounting/types";

const company = buildDemoCompanies().find((item) => item.id === "co-nakheel")!;
const data = buildDemoData()[company.id];
const ledger: Ledger = {
  accounts: data.accounts,
  entries: data.entries,
  periods: data.periods,
  currency: company.currency,
};
const context = buildAssistantContext({
  company,
  data,
  ledger,
  period: { from: "2025-01-01", to: "2025-12-31" },
});

let server: Server;
let reply = "";
let status = 200;
let calls = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      calls += 1;
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(
          status === 200 ? { choices: [{ message: { content: reply } }] } : { error: { message: "upstream" } },
        ),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");
  process.env.AI_PROVIDER_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  reply = "";
  status = 200;
  calls = 0;
  process.env.AI_PROVIDER_API_KEY = "test-key";
  process.env.AI_MODEL = "test-model";
  process.env.AI_TIMEOUT_MS = "2000";
});

afterEach(() => {
  delete process.env.AI_PROVIDER_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.AI_TIMEOUT_MS;
});

describe("المساعد الذكي — الربط والحماية", () => {
  it("يعرض إجابة النموذج عندما تكون أرقامه مستمدة من الحسابات", async () => {
    reply = "صافي الربح 45,542.11 ر.س، والهامش 2.1%.";
    const result = await askAssistant("ما صافي الربح؟", context);
    expect(result.mode).toBe("ai");
    expect(result.answer).toContain("45,542.11");
    expect(calls).toBe(1);
  });

  it("يستبدل إجابة النموذج إذا احتوت رقماً غير محسوب", async () => {
    reply = "صافي الربح 78,320.00 ر.س.";
    const result = await askAssistant("ما صافي الربح؟", context);
    expect(result.mode).toBe("local");
    expect(result.fallbackReason).toContain("غير مستمدة");
    expect(result.answer).not.toContain("78,320");
  });

  it("يعود إلى الحساب المحلي عند فشل المزود", async () => {
    status = 500;
    const result = await askAssistant("ما صافي الربح؟", context);
    expect(result.mode).toBe("local");
    expect(result.fallbackReason).toContain("محسوبة محلياً");
    expect(calls).toBe(2);
  });

  it("لا يستدعي أي مزود عند غياب المفتاح", async () => {
    delete process.env.AI_PROVIDER_API_KEY;
    const result = await askAssistant("ما صافي الربح؟", context);
    expect(result.mode).toBe("local");
    expect(result.fallbackReason).toBeUndefined();
    expect(calls).toBe(0);
  });
});
