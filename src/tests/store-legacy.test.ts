import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "rakaz-legacy-"));
process.env.RAKAZ_DATA_DIR = dir;
process.env.RAKAZ_DATA_MODE = "demo";

describe("ترحيل ملف تخزين قديم", () => {
  it("يضيف roles وcustomRoleId عند تحميل ملف لا يحتويهما", async () => {
    const { buildDemoStore } = await import("@/lib/data/demo-data");
    const store = await buildDemoStore();
    const legacy = { ...store } as Record<string, unknown>;
    delete legacy.roles;
    legacy.members = store.members.map(({ customRoleId: _drop, ...member }) => member);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "demo-store.json"), JSON.stringify(legacy));

    const { readStore } = await import("@/lib/data/store");
    const loaded = await readStore();
    expect(Array.isArray(loaded.roles)).toBe(true);
    expect(loaded.roles).toHaveLength(0);
    for (const member of loaded.members) {
      expect(member.customRoleId ?? null).toBeNull();
    }
  });
});
