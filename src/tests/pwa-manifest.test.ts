import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const data = manifest();

function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(path.join(process.cwd(), file));
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("Web App Manifest", () => {
  it("يحمل هوية ركاز العربية", () => {
    expect(data.name).toContain("RAKAZ AI");
    expect(data.name).toContain("ركاز");
    expect(data.short_name).toBe("ركاز");
    expect(data.lang).toBe("ar");
    expect(data.dir).toBe("rtl");
  });

  it("يعمل كتطبيق مستقل", () => {
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/dashboard");
    expect(data.scope).toBe("/");
    expect(data.theme_color).toBe("#08352a");
    expect(data.background_color).toBe("#f8fafc");
  });

  it("يتضمن أيقونات 192 و512 وأيقونة maskable", () => {
    const icons = data.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("كل أيقونة مذكورة موجودة فعلياً وبالمقاس الصحيح", () => {
    for (const icon of data.icons ?? []) {
      const file = path.join("public", icon.src.replace(/^\//, ""));
      expect(existsSync(path.join(process.cwd(), file))).toBe(true);
      const [width, height] = String(icon.sizes).split("x").map(Number);
      expect(pngSize(file)).toEqual({ width, height });
    }
  });

  it("يوفر اختصارات للصفحات الأساسية", () => {
    const urls = (data.shortcuts ?? []).map((shortcut) => shortcut.url);
    expect(urls).toEqual(["/dashboard", "/statements", "/findings"]);
  });
});
