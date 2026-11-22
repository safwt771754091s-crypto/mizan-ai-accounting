export type DataMode = "demo" | "supabase";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function dataMode(): DataMode {
  const explicit = (process.env.RAKAZ_DATA_MODE ?? process.env.MIZAN_DATA_MODE)?.trim();
  if (explicit === "supabase") return "supabase";
  if (explicit === "demo") return "demo";
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY);
}

export function aiModel(): string {
  return process.env.AI_MODEL ?? "gpt-4.1-mini";
}

export function aiBaseUrl(): string {
  return (process.env.AI_PROVIDER_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["xlsx", "xls", "csv", "pdf"] as const;
