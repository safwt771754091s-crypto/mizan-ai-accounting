import { androidPackageId, buildAssetLinks, parseFingerprints } from "@/lib/android/assetlinks";

export const dynamic = "force-dynamic";

export async function GET() {
  const links = buildAssetLinks({
    packageId: androidPackageId(),
    fingerprints: parseFingerprints(process.env.ANDROID_SHA256_CERT_FINGERPRINTS),
  });

  return Response.json(links, {
    headers: { "Cache-Control": "public, max-age=300, must-revalidate" },
  });
}
