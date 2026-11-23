/** كشف بيئة التشغيل — دوال خالصة تُغذّى من قيم المتصفح لتكون قابلة للاختبار. */

export function isStandaloneMode(displayModeStandalone: boolean, navigatorStandalone?: boolean): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

export function isIosDevice(userAgent: string, platform?: string): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ يعلن نفسه Macintosh مع لمس متعدد.
  return platform === "MacIntel" && /Macintosh/.test(userAgent);
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}
