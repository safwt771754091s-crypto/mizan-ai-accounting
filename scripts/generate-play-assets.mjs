// يولّد أصول Google Play من هوية ركاز: أيقونة 512 ورسم الميزة 1024×500.
// التشغيل: node scripts/generate-play-assets.mjs
import { chromium } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";

const SCALE = `
  <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
  <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
  <path d="M7 21h10"/><path d="M12 3v18"/>
  <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
`;

const feature = `<div style="width:1024px;height:500px;position:relative;overflow:hidden;
    background:linear-gradient(135deg,#04241d 0%,#08352a 45%,#166a52 100%);
    display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box;direction:rtl;
    font-family:'Noto Naskh Arabic','DejaVu Sans',system-ui,sans-serif">
  <div style="position:absolute;inset-inline-start:-120px;top:-140px;width:420px;height:420px;border-radius:9999px;background:#ffffff;opacity:.05;filter:blur(40px)"></div>
  <div style="position:absolute;inset-inline-end:-80px;bottom:-160px;width:420px;height:420px;border-radius:9999px;background:#4aa181;opacity:.18;filter:blur(50px)"></div>
  <div style="width:200px;height:200px;border-radius:48px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);
      display:flex;align-items:center;justify-content:center;flex:none">
    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.7"
         stroke-linecap="round" stroke-linejoin="round">${SCALE}</svg>
  </div>
  <div style="color:#ffffff;position:relative;width:620px;display:flex;flex-direction:column;gap:10px;align-items:flex-start">
    <div style="font-size:78px;font-weight:800;line-height:1">ركاز</div>
    <div style="font-size:17px;letter-spacing:.44em;color:#a4e8db">RAKAZ AI</div>
    <div style="font-size:22px;color:rgba(255,255,255,.8);line-height:1.5;margin-top:6px">
      منصة الذكاء المحاسبي والمالي
    </div>
  </div>
</div>`;

await mkdir("play-store", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 560 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;background:transparent">${feature}</body>`);
await page.locator("div").first().screenshot({ path: "play-store/feature-graphic-1024x500.png" });
await browser.close();

await copyFile("public/icons/icon-512.png", "play-store/icon-512.png");
console.log("✓ play-store/feature-graphic-1024x500.png");
console.log("✓ play-store/icon-512.png");
