import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
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
};

export const viewport: Viewport = {
  themeColor: "#08352a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
