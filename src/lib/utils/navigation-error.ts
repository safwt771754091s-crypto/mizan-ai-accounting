/**
 * `redirect()` و`notFound()` يرميان خطأً داخلياً يجب ألا يبتلعه catch.
 * Next 16 يضع العلامة في `digest` وليس في `message`، لذا نفحص الاثنين.
 */
export function isNavigationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))) {
    return true;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && (message.includes("NEXT_REDIRECT") || message.includes("NEXT_NOT_FOUND"));
}
