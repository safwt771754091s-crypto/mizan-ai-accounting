"use client";

// يستخدم أنماطاً مضمّنة لأن هذا الملف يستبدل الـ layout الجذري عند فشله.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "system-ui, 'Segoe UI', Tahoma, sans-serif",
          color: "#0f2d24",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>تعذّر تحميل المنصة</h1>
          <p style={{ fontSize: 14, lineHeight: 1.9, color: "#5b6b66", margin: "0 0 20px" }}>
            حدث خطأ غير متوقع أثناء تجهيز الصفحة. بياناتك محفوظة ولم تُحذف.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#5b6b66", direction: "ltr" }}>
              ERROR {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "#0b3d31",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
