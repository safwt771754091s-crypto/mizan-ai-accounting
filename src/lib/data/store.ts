import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDemoStore } from "./demo-data";
import type { DemoStore } from "./types";

/**
 * مسار ملف بيانات الوضع التجريبي.
 * على منصات الاستضافة بلا قرص دائم (Vercel/Lambda) مجلد المشروع للقراءة فقط،
 * لذلك نستخدم مجلد الملفات المؤقتة القابل للكتابة بدل الانهيار.
 */
function resolveStoreDir(): string {
  const explicit = (process.env.RAKAZ_DATA_DIR ?? process.env.MIZAN_DATA_DIR)?.trim();
  if (explicit) return explicit;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    return path.join(os.tmpdir(), "rakaz-data");
  }
  return path.join(process.cwd(), ".rakaz-data");
}

function resolveStoreFile(dir = resolveStoreDir()): string {
  return path.join(dir, "demo-store.json");
}

interface StoreState {
  cache: DemoStore | null;
  signature: string | null;
  persistenceDisabled: boolean;
  queue: Promise<unknown>;
}

/**
 * Next يحمّل الوحدة أكثر من مرة (صفحات، route handlers، HMR) وكل نسخة لها متغيراتها،
 * لكن globalThis مشترك داخل العملية نفسها. الحالة هناك تضمن أن ما يكتبه route handler
 * يراه الصفحات فوراً حتى لو تعذّر الحفظ على القرص.
 */
const STATE_KEY = "__rakazDemoStoreStates";
const globalStates = globalThis as unknown as Record<string, Map<string, StoreState> | undefined>;
const states = (globalStates[STATE_KEY] ??= new Map<string, StoreState>());

function stateFor(dir: string): StoreState {
  let state = states.get(dir);
  if (!state) {
    state = { cache: null, signature: null, persistenceDisabled: false, queue: Promise.resolve() };
    states.set(dir, state);
  }
  return state;
}

/**
 * بصمة الملف تمنع بقاء نسخة قديمة في الذاكرة عندما يكتب مسار آخر (route handler)
 * بينما يحتفظ مسار الصفحات بنسخته الخاصة من الوحدة.
 */
async function signature(file: string): Promise<string | null> {
  try {
    const stat = await fs.stat(file, { bigint: true });
    return `${stat.mtimeNs}:${stat.size}`;
  } catch {
    return null;
  }
}

async function load(): Promise<DemoStore> {
  const dir = resolveStoreDir();
  const file = resolveStoreFile(dir);
  const state = stateFor(dir);

  const current = await signature(file);
  if (state.cache && current === state.signature) return state.cache;

  if (current) {
    try {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as DemoStore;
      if (parsed?.version === 1) {
        // ملفات قديمة قد تسبق إضافة الأدوار المخصصة — نطبّع الحقول الجديدة.
        if (!Array.isArray(parsed.roles)) parsed.roles = [];
        if (!Array.isArray(parsed.audit)) parsed.audit = [];
        for (const member of parsed.members) {
          if (member.customRoleId === undefined) member.customRoleId = null;
        }
        state.cache = parsed;
        state.signature = current;
        return parsed;
      }
    } catch {
      // ملف تالف أو قيد الكتابة — نعيد البناء.
    }
  }

  const seeded = await buildDemoStore();
  state.cache = seeded;
  state.signature = current;
  await persist(dir, state, seeded);
  return state.cache ?? seeded;
}

/**
 * الحفظ على القرص ليس شرطاً لعمل المنصة: عند تعذّره (نظام ملفات للقراءة فقط)
 * نستمر بتخزين في الذاكرة ونطبع تحذيراً واضحاً بدل إسقاط كل صفحة بخطأ 500.
 */
async function persist(dir: string, state: StoreState, store: DemoStore): Promise<void> {
  state.cache = store;
  state.signature = null;
  if (state.persistenceDisabled) return;

  const file = resolveStoreFile(dir);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(temp, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(temp, file);
    state.signature = await signature(file);
  } catch (error) {
    state.persistenceDisabled = true;
    const code = (error as NodeJS.ErrnoException)?.code ?? "UNKNOWN";
    console.warn(
      `[rakaz] تعذّر حفظ بيانات الوضع التجريبي في ${file} (${code}). ` +
        "سيُستخدم تخزين مؤقت في الذاكرة لهذه النسخة. اضبط متغيرات Supabase لتخزين دائم.",
    );
    await fs.rm(temp, { force: true }).catch(() => undefined);
  }
}

export async function readStore(): Promise<DemoStore> {
  return load();
}

/** كل عمليات الكتابة تُسلسل لتجنب تضارب الملف. */
export async function mutateStore<T>(mutator: (store: DemoStore) => T | Promise<T>): Promise<T> {
  const dir = resolveStoreDir();
  const state = stateFor(dir);
  const run = state.queue.then(async () => {
    const store = await load();
    const result = await mutator(store);
    await persist(dir, state, store);
    return result;
  });
  state.queue = run.catch(() => undefined);
  return run;
}

export async function resetStore(): Promise<void> {
  const dir = resolveStoreDir();
  const state = stateFor(dir);
  state.cache = await buildDemoStore();
  await persist(dir, state, state.cache);
}

export function storeFilePath(): string {
  return resolveStoreFile();
}
