export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

interface ProviderConfig {
  key: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function aiConfig(): ProviderConfig {
  return {
    key: (process.env.AI_PROVIDER_API_KEY ?? process.env.AI_API_KEY ?? "").trim(),
    baseUrl: (process.env.AI_PROVIDER_BASE_URL ?? "https://api.openai.com/v1").trim().replace(/\/+$/, ""),
    model: (process.env.AI_MODEL ?? "gpt-4.1-mini").trim(),
    maxTokens: positiveInt(process.env.AI_MAX_TOKENS, 800),
    timeoutMs: positiveInt(process.env.AI_TIMEOUT_MS, 20000),
  };
}

interface CompletionPayload {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  error?: { message?: string; type?: string };
}

function readContent(payload: CompletionPayload): string | null {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim() || null;
  if (Array.isArray(content)) {
    const joined = content.map((part) => part?.text ?? "").join("").trim();
    return joined || null;
  }
  return null;
}

function providerMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as CompletionPayload;
    const message = parsed.error?.message ?? "";
    return message.slice(0, 160);
  } catch {
    return "";
  }
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function requestOnce(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: config.maxTokens,
      messages,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = providerMessage(body);
    throw new AiProviderError(
      `AI provider error ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }

  let payload: CompletionPayload;
  try {
    payload = (await response.json()) as CompletionPayload;
  } catch {
    throw new AiProviderError("AI provider returned invalid JSON");
  }

  const content = readContent(payload);
  if (!content) throw new AiProviderError("AI provider returned an empty response");
  return content;
}

/** استدعاء متوافق مع Chat Completions، مع إعادة محاولة واحدة عند أخطاء 429/5xx. */
export async function callChatCompletion(messages: ChatMessage[]): Promise<string> {
  const config = aiConfig();
  if (!config.key) throw new AiProviderError("AI provider key is not configured");

  try {
    return await requestOnce(config, messages);
  } catch (error) {
    const status = error instanceof AiProviderError ? error.status : undefined;
    if (status && isRetryable(status)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return requestOnce(config, messages);
    }
    throw error;
  }
}

export function describeProviderFailure(error: unknown): string {
  if (!(error instanceof Error)) return "تعذر الاتصال بمزود الذكاء الاصطناعي.";
  if (error.name === "TimeoutError" || error.message.includes("timeout")) {
    return "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي.";
  }
  if (error instanceof AiProviderError && error.status) {
    if (error.status === 401 || error.status === 403) return "مفتاح مزود الذكاء الاصطناعي غير صالح أو منتهي.";
    if (error.status === 429) return "تجاوز مزود الذكاء الاصطناعي حد الطلبات المسموح.";
    return `مزود الذكاء الاصطناعي أعاد خطأ ${error.status}.`;
  }
  return "تعذر الاتصال بمزود الذكاء الاصطناعي.";
}
