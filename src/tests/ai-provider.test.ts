import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AiProviderError, callChatCompletion, describeProviderFailure } from "@/lib/ai/provider";

interface ReceivedRequest {
  authorization: string | undefined;
  body: { model?: string; messages?: Array<{ role: string; content: string }> };
}

let server: Server;
let baseUrl = "";
let received: ReceivedRequest[] = [];
let scenario: "ok" | "retry" | "unauthorized" | "invalid-json" | "slow" = "ok";
let attempts = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      attempts += 1;
      received.push({ authorization: request.headers.authorization, body: JSON.parse(raw || "{}") });
      const send = (status: number, payload: unknown) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(typeof payload === "string" ? payload : JSON.stringify(payload));
      };

      if (scenario === "unauthorized") return send(401, { error: { message: "invalid api key" } });
      if (scenario === "retry" && attempts === 1) return send(503, { error: { message: "busy" } });
      if (scenario === "invalid-json") return send(200, "not-json");
      if (scenario === "slow") {
        setTimeout(() => send(200, { choices: [{ message: { content: "متأخر" } }] }), 400);
        return;
      }
      send(200, { choices: [{ message: { content: "صافي الربح 45,542.11 ر.س" } }] });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");
  baseUrl = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  received = [];
  attempts = 0;
  scenario = "ok";
  process.env.AI_PROVIDER_API_KEY = "test-key";
  process.env.AI_PROVIDER_BASE_URL = baseUrl;
  process.env.AI_MODEL = "test-model";
  process.env.AI_TIMEOUT_MS = "2000";
});

afterEach(() => {
  delete process.env.AI_PROVIDER_API_KEY;
  delete process.env.AI_API_KEY;
  delete process.env.AI_PROVIDER_BASE_URL;
  delete process.env.AI_MODEL;
  delete process.env.AI_TIMEOUT_MS;
});

describe("مزود الذكاء الاصطناعي", () => {
  it("يرسل المفتاح والنموذج ويعيد المحتوى", async () => {
    const content = await callChatCompletion([
      { role: "system", content: "نظام" },
      { role: "user", content: "سؤال" },
    ]);
    expect(content).toBe("صافي الربح 45,542.11 ر.س");
    expect(received[0].authorization).toBe("Bearer test-key");
    expect(received[0].body.model).toBe("test-model");
    expect(received[0].body.messages?.[1].content).toBe("سؤال");
  });

  it("يعيد المحاولة مرة واحدة عند 5xx", async () => {
    scenario = "retry";
    const content = await callChatCompletion([{ role: "user", content: "سؤال" }]);
    expect(content).toContain("45,542.11");
    expect(attempts).toBe(2);
  });

  it("يترجم خطأ 401 إلى رسالة مفتاح غير صالح", async () => {
    scenario = "unauthorized";
    const error = await callChatCompletion([{ role: "user", content: "سؤال" }]).catch((caught) => caught);
    expect(error).toBeInstanceOf(AiProviderError);
    expect(describeProviderFailure(error)).toContain("غير صالح");
  });

  it("يرفض استجابة غير صالحة", async () => {
    scenario = "invalid-json";
    const error = await callChatCompletion([{ role: "user", content: "سؤال" }]).catch((caught) => caught);
    expect(error).toBeInstanceOf(AiProviderError);
  });

  it("يحترم مهلة الاتصال", async () => {
    scenario = "slow";
    process.env.AI_TIMEOUT_MS = "50";
    const error = await callChatCompletion([{ role: "user", content: "سؤال" }]).catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(describeProviderFailure(error)).toContain("مهلة");
  });

  it("يرفض العمل بدون مفتاح", async () => {
    delete process.env.AI_PROVIDER_API_KEY;
    await expect(callChatCompletion([{ role: "user", content: "سؤال" }])).rejects.toBeInstanceOf(AiProviderError);
  });
});
