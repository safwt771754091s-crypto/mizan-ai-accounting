import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.RAKAZ_DATA_DIR;
const originalVercel = process.env.VERCEL;
const dirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

async function freshStore(dataDir: string | null, extraEnv: Record<string, string> = {}) {
  if (dataDir) process.env.RAKAZ_DATA_DIR = dataDir;
  else delete process.env.RAKAZ_DATA_DIR;
  Object.assign(process.env, extraEnv);
  vi.resetModules();
  return import("@/lib/data/store");
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  if (originalDataDir) process.env.RAKAZ_DATA_DIR = originalDataDir;
  else delete process.env.RAKAZ_DATA_DIR;
  if (originalVercel) process.env.VERCEL = originalVercel;
  else delete process.env.VERCEL;
  for (const dir of dirs.splice(0)) {
    try {
      chmodSync(dir, 0o755);
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // تجاهل تنظيف مجلدات الاختبار
    }
  }
});

afterAll(() => {
  if (originalDataDir) process.env.RAKAZ_DATA_DIR = originalDataDir;
  else delete process.env.RAKAZ_DATA_DIR;
});

describe("تخزين الوضع التجريبي", () => {
  it("يحفظ على القرص عندما يكون المجلد قابلاً للكتابة", async () => {
    const dir = tempDir("rakaz-rw-");
    const store = await freshStore(dir);
    const data = await store.readStore();
    expect(data.users.length).toBeGreaterThan(0);
    const file = store.storeFilePath();
    expect(statSync(file).size).toBeGreaterThan(1000);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved.version).toBe(1);
  });

  it("لا يُسقط الطلبات عندما يكون نظام الملفات للقراءة فقط", async () => {
    const dir = tempDir("rakaz-ro-");
    chmodSync(dir, 0o555);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = await freshStore(dir);

    const data = await store.readStore();
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.companies.length).toBeGreaterThan(0);

    const created = await store.mutateStore((draft) => {
      draft.users.push({
        id: "user-readonly",
        email: "readonly@example.com",
        fullName: "مستخدم قراءة فقط",
        isSuperAdmin: false,
        createdAt: new Date().toISOString(),
        passwordHash: "x",
      });
      return draft.users.length;
    });
    expect(created).toBeGreaterThan(0);

    const again = await store.readStore();
    expect(again.users.some((user) => user.id === "user-readonly")).toBe(true);
    expect(warn).toHaveBeenCalled();
    expect(() => statSync(path.join(dir, "demo-store.json"))).toThrow();
  });

  it("يستخدم مجلداً مؤقتاً على منصات الاستضافة بدل مجلد المشروع", async () => {
    const store = await freshStore(null, { VERCEL: "1" });
    const file = store.storeFilePath();
    expect(file.startsWith(tmpdir())).toBe(true);
    expect(file.includes(process.cwd())).toBe(false);
  });

  it("يحترم RAKAZ_DATA_DIR الصريح", async () => {
    const dir = tempDir("rakaz-explicit-");
    const store = await freshStore(dir);
    expect(store.storeFilePath()).toBe(path.join(dir, "demo-store.json"));
  });
});
