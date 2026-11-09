import { ANDROID_CERT_SHA256, ANDROID_PACKAGE } from "@/lib/android";

export const dynamic = "force-static";

/** Digital Asset Links: le confirma a Android que la app de Google Play pertenece a este sitio. */
export function GET() {
  const body = ANDROID_CERT_SHA256.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: ANDROID_CERT_SHA256 } }]
    : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
