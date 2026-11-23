// يولّد أيقونات PWA من نفس هوية ركاز (بدون ملفات تصميم خارجية).
// التشغيل: node scripts/generate-pwa-icons.mjs
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const SCALE_PATHS = `
  <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
  <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
  <path d="M7 21h10"/><path d="M12 3v18"/>
  <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
`;

function svg(size, glyphRatio) {
  const glyph = Math.round(size * glyphRatio);
  const offset = (size - glyph) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#08352a"/>
        <stop offset="55%" stop-color="#0b4234"/>
        <stop offset="100%" stop-color="#166a52"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
    <g transform="translate(${offset} ${offset}) scale(${glyph / 24})"
       fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      ${SCALE_PATHS}
    </g>
  </svg>`;
}

const targets = [
  { file: "public/icons/icon-192.png", size: 192, ratio: 0.62 },
  { file: "public/icons/icon-512.png", size: 512, ratio: 0.62 },
  { file: "public/icons/icon-maskable-512.png", size: 512, ratio: 0.46 },
  { file: "public/icons/apple-touch-icon.png", size: 180, ratio: 0.6 },
  { file: "src/app/icon.png", size: 512, ratio: 0.62 },
  { file: "src/app/apple-icon.png", size: 180, ratio: 0.6 },
];

await mkdir("public/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
for (const { file, size, ratio } of targets) {
  await page.setContent(
    `<body style="margin:0;background:transparent"><div id="i" style="width:${size}px;height:${size}px">${svg(size, ratio)}</div></body>`,
  );
  await page.locator("#i").screenshot({ path: file });
  console.log("✓", file, `${size}×${size}`);
}
await browser.close();
