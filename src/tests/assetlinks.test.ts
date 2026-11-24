import { describe, expect, it } from "vitest";
import { DEFAULT_ANDROID_PACKAGE_ID, androidPackageId, buildAssetLinks, normalizeFingerprint, parseFingerprints } from "@/lib/android/assetlinks";

const SHA = "a".repeat(32) + "b".repeat(32); // 64 خانة hex
const FORMATTED = SHA.toUpperCase().match(/.{2}/g)!.join(":");

describe("بصمات شهادة التوقيع", () => {
  it("تُطبَّع البصمة إلى صيغة AA:BB المطلوبة", () => {
    expect(normalizeFingerprint(SHA)).toBe(FORMATTED);
    expect(normalizeFingerprint(FORMATTED.toLowerCase())).toBe(FORMATTED);
    expect(normalizeFingerprint(`  ${FORMATTED}  `)).toBe(FORMATTED);
  });

  it("ترفض أي بصمة غير صالحة بدل تمريرها كما هي", () => {
    expect(normalizeFingerprint("")).toBeNull();
    expect(normalizeFingerprint("abcd")).toBeNull();
    expect(normalizeFingerprint("z".repeat(64))).toBeNull();
    expect(normalizeFingerprint("a".repeat(63))).toBeNull();
  });

  it("تقرأ عدة بصمات مفصولة بفواصل أو أسطر وتزيل التكرار", () => {
    const second = "c".repeat(64);
    const parsed = parseFingerprints(`${SHA}, ${second}\n${FORMATTED}`);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toBe(FORMATTED);
    expect(parseFingerprints(undefined)).toEqual([]);
  });
});

describe("ملف Digital Asset Links", () => {
  it("يعيد مصفوفة فارغة بلا بصمات بدل ملف غير صالح", () => {
    expect(buildAssetLinks({ fingerprints: [] })).toEqual([]);
  });

  it("يبني الربط الصحيح بين التطبيق والدومين", () => {
    const links = buildAssetLinks({ packageId: DEFAULT_ANDROID_PACKAGE_ID, fingerprints: [FORMATTED] });
    expect(links).toHaveLength(1);
    expect(links[0].relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect(links[0].target.namespace).toBe("android_app");
    expect(links[0].target.package_name).toBe("ai.rakaz.twa");
    expect(links[0].target.sha256_cert_fingerprints).toEqual([FORMATTED]);
  });

  it("يقبل معرّف حزمة صحيحاً ويرفض غير الصالح", () => {
    expect(androidPackageId("ai.rakaz.app")).toBe("ai.rakaz.app");
    expect(androidPackageId("Rakaz")).toBe(DEFAULT_ANDROID_PACKAGE_ID);
    expect(androidPackageId("ai.rakaz-app")).toBe(DEFAULT_ANDROID_PACKAGE_ID);
    expect(androidPackageId(undefined)).toBe(DEFAULT_ANDROID_PACKAGE_ID);
  });
});
