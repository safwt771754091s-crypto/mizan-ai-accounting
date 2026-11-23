import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorkerProvider } from "@/components/pwa/service-worker-provider";
import { InstallPromptBanner } from "@/components/pwa/install-prompt-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ركاز | RAKAZ AI — منصة الذكاء المحاسبي والمالي",
    template: "%s | RAKAZ AI",
  },
  applicationName: "RAKAZ AI",
  description:
    "ركاز — منصة الذكاء المحاسبي والمالي: تحليل البيانات المحاسبية، إعداد القوائم المالية، اكتشاف الأخطاء والقيود المكررة، ومراجعة المخاطر المالية بمساعدة الذكاء الاصطناعي.",
  keywords: ["محاسبة", "تحليل مالي", "ميزان المراجعة", "قوائم مالية", "مراجعة", "RAKAZ AI"],
  authors: [{ name: "RAKAZ AI" }],
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ركاز", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#08352a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
        <ServiceWorkerProvider />
        {children}
        <InstallPromptBanner />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
