import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RAKAZ AI — ركاز | منصة الذكاء المحاسبي والمالي",
    short_name: "ركاز",
    description:
      "ركاز — تحليل البيانات المحاسبية، القوائم المالية، اكتشاف الأخطاء والقيود المكررة، ومراجعة المخاطر المالية.",
    lang: "ar",
    dir: "rtl",
    start_url: "/dashboard",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8fafc",
    theme_color: "#08352a",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "لوحة التحكم", short_name: "اللوحة", url: "/dashboard" },
      { name: "القوائم المالية", short_name: "القوائم", url: "/statements" },
      { name: "اكتشاف الأخطاء", short_name: "الأخطاء", url: "/findings" },
    ],
  };
}
