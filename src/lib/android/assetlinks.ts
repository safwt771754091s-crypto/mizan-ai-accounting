/**
 * Digital Asset Links — تربط تطبيق Android (TWA) بالدومين.
 * بدون بصمة توقيع صحيحة لا يستطيع Android التحقق من ملكية الدومين، فيظهر شريط العنوان.
 */

export const DEFAULT_ANDROID_PACKAGE_ID = "ai.rakaz.twa";

export interface AssetLink {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

/** بصمة SHA-256 لشهادة التوقيع: 64 خانة hex، تُعرض بصيغة AA:BB:… */
export function normalizeFingerprint(value: string): string | null {
  const cleaned = value.trim().replace(/:/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(cleaned)) return null;
  const pairs = cleaned.match(/.{2}/g);
  return pairs ? pairs.join(":") : null;
}

export function parseFingerprints(raw: string | undefined): string[] {
  const values = (raw ?? "")
    .split(/[,\s]+/)
    .map(normalizeFingerprint)
    .filter((fingerprint): fingerprint is string => fingerprint !== null);
  return [...new Set(values)];
}

export function androidPackageId(raw: string | undefined = process.env.ANDROID_APP_PACKAGE): string {
  const value = (raw ?? "").trim();
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value) ? value : DEFAULT_ANDROID_PACKAGE_ID;
}

export function buildAssetLinks(options: { packageId?: string; fingerprints: string[] }): AssetLink[] {
  if (options.fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: options.packageId ?? DEFAULT_ANDROID_PACKAGE_ID,
        sha256_cert_fingerprints: options.fingerprints,
      },
    },
  ];
}
