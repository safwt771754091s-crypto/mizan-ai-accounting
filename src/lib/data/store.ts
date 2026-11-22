import { promises as fs } from "node:fs";
import path from "node:path";
import { buildDemoStore } from "./demo-data";
import type { DemoStore } from "./types";

const STORE_DIR =
  process.env.RAKAZ_DATA_DIR ?? process.env.MIZAN_DATA_DIR ?? path.join(process.cwd(), ".rakaz-data");
const STORE_FILE = path.join(STORE_DIR, "demo-store.json");

let cache: DemoStore | null = null;
let cacheSignature: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

/**
 * بصمة الملف تمنع بقاء نسخة قديمة في الذاكرة عندما يكتب مسار آخر (route handler)
 * بينما يحتفظ مسار الصفحات بنسخته الخاصة من الوحدة.
 */
async function signature(): Promise<string | null> {
  try {
    const stat = await fs.stat(STORE_FILE, { bigint: true });
    return `${stat.mtimeNs}:${stat.size}`;
  } catch {
    return null;
  }
}

async function load(): Promise<DemoStore> {
  const current = await signature();
  if (cache && current && current === cacheSignature) return cache;

  if (current) {
    try {
      const parsed = JSON.parse(await fs.readFile(STORE_FILE, "utf8")) as DemoStore;
      if (parsed?.version === 1) {
        cache = parsed;
        cacheSignature = current;
        return parsed;
      }
    } catch {
      // ملف تالف أو قيد الكتابة — نعيد البناء.
    }
  }

  const seeded = await buildDemoStore();
  cache = seeded;
  await persist(seeded);
  return seeded;
}

async function persist(store: DemoStore): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  const temp = `${STORE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(temp, STORE_FILE);
  cache = store;
  cacheSignature = await signature();
}

export async function readStore(): Promise<DemoStore> {
  return load();
}

/** كل عمليات الكتابة تُسلسل لتجنب تضارب الملف. */
export async function mutateStore<T>(mutator: (store: DemoStore) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const store = await load();
    const result = await mutator(store);
    await persist(store);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function resetStore(): Promise<void> {
  cache = await buildDemoStore();
  await persist(cache);
}

export function storeFilePath(): string {
  return STORE_FILE;
}
