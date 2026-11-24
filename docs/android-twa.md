# تحويل ركاز إلى تطبيق Android عبر TWA

> **الحالة:** جاهزية كاملة على جانب الويب + إعداد TWA جاهز للتوليد.
> **لم يُبنَ APK/AAB ولم يُختبر على جهاز** — لا يوجد JDK ولا Android SDK في بيئة التنفيذ،
> ومفتاح التوقيع يجب أن تملكه أنت ولا يُخزَّن في المستودع.

## 1. لماذا TWA وليس Capacitor

انظر [`android-readiness.md`](./android-readiness.md). باختصار: ركاز يعتمد SSR وServer Actions
وكوكيز Supabase على الخادم؛ TWA يعرض نفس الموقع المنشور داخل Chrome موثوق، فلا نكرر المصادقة
ولا نبني نسخة ثانية من التطبيق، والتحديث يصل مع كل نشر ويب.

## 2. ما أُنجز في هذه المرحلة

| المكوّن | الملف | الحالة |
| --- | --- | --- |
| Digital Asset Links | `src/app/api/well-known/assetlinks/route.ts` + rewrite في `next.config.ts` | ✅ يعمل |
| منطق البصمات | `src/lib/android/assetlinks.ts` | ✅ مُختبر |
| إعداد TWA | `android/twa-manifest.json` | ✅ جاهز للتوليد |
| أصول Play | `play-store/icon-512.png` · `play-store/feature-graphic-1024x500.png` | ✅ مولّدة |
| حماية المفاتيح | `.gitignore` (`*.keystore`, `*.jks`, `*.aab`, `*.apk`) | ✅ |
| متغيرات البيئة | `.env.example` (`ANDROID_APP_PACKAGE`, `ANDROID_SHA256_CERT_FINGERPRINTS`) | ✅ |
| مشروع Android / APK | — | ❌ لم يُنشأ (يحتاج JDK + SDK + مفتاحك) |

## 3. المسار التقني

```
المستخدم يفتح التطبيق
  └─ TWA (Chrome Custom Tab موثوق) يفتح https://mizan-ai-accounting.vercel.app
       └─ Android يتحقق من /.well-known/assetlinks.json
            ├─ مطابق  → بلا شريط عنوان (تجربة تطبيق كاملة)
            └─ غير مطابق → يظهر شريط العنوان (تدهور آمن، لا انهيار)
```

`/.well-known/assetlinks.json` يُخدم من route handler يقرأ البصمة من متغير بيئة، فلا حاجة لإعادة
بناء عند تدوير المفتاح:

- بلا `ANDROID_SHA256_CERT_FINGERPRINTS` → يُرجع `[]` (JSON صالح، والتحقق يفشل بأمان).
- بصمة غير صالحة → تُهمَل ولا تُمرَّر (لا نُصدر ملفاً يكسر التحقق).
- عدة بصمات (مفتاح إصدار + مفتاح Play App Signing) → مفصولة بفواصل.

## 4. الخطوات المطلوبة منك (مرة واحدة)

### أ. تجهيز الأدوات على جهازك

```bash
# JDK 17 + Android SDK (Android Studio أو commandline-tools)
npm i -g @bubblewrap/cli
```

### ب. إنشاء مفتاح التوقيع — لا ترفعه إلى Git أبداً

```bash
keytool -genkeypair -v \
  -keystore android.keystore -alias android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=RAKAZ AI, O=RAKAZ, C=SA"
```

احفظ الملف وكلمة مروره في مكان آمن (خسارته تعني عدم القدرة على تحديث التطبيق على Play).

### ج. توليد مشروع Android

```bash
bubblewrap init --manifest android/twa-manifest.json
bubblewrap build          # ينتج app-release-signed.apk و app-release-bundle.aab
```

### د. استخراج البصمة وإضافتها إلى البيئة

```bash
keytool -list -v -keystore android.keystore -alias android | grep SHA256
```

ثم في Vercel (Production + Preview):

```
ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:CC:…
ANDROID_APP_PACKAGE=ai.rakaz.twa
```

وأعد النشر، ثم تحقق:

```bash
curl -s https://mizan-ai-accounting.vercel.app/.well-known/assetlinks.json | jq
```

يجب أن يظهر `package_name` وبصمتك. بدون هذه الخطوة سيظهر شريط العنوان داخل التطبيق.

### هـ. اختبار على جهاز

```bash
adb install app-release-signed.apk
# افتح التطبيق: يجب ألا يظهر شريط عنوان، وتسجيل الدخول يعمل كما في Chrome
```

### و. النشر في Google Play

1. حساب Play Console (رسوم لمرة واحدة).
2. بطاقة المتجر: الاسم «ركاز»، الوصف، الأيقونة `play-store/icon-512.png`،
   الرسم `play-store/feature-graphic-1024x500.png`.
3. لقطات شاشة هاتف (مطلوبة): تُؤخذ من التطبيق الفعلي بعد النشر.
4. سياسة خصوصية منشورة على رابط عام (مطلوبة).
5. رفع `app-release-bundle.aab`، ثم مراجعة Google.
6. عند تفعيل **Play App Signing** أضف بصمة Google الثانية إلى
   `ANDROID_SHA256_CERT_FINGERPRINTS` (مفصولة بفاصلة).

## 5. عند إصدار نسخة جديدة

1. ارفع `APP_VERSION` و`CACHE_VERSION` (انظر `docs/pwa.md §6`).
2. ارفع `appVersionName` و`appVersionCode` في `android/twa-manifest.json`
   (`appVersionCode` يجب أن يزيد دائماً، والاختبار يتحقق من صحته).
3. `bubblewrap update && bubblewrap build` ثم ارفع AAB جديداً.
4. محتوى الويب يتحدث تلقائياً مع النشر؛ الغلاف الأصلي يتحدث فقط عند تغيير يحتاج صلاحية جديدة.

## 6. القيود المعروفة

- TWA يعمل على Chrome/متصفحات تدعم Trusted Web Activity؛ الأجهزة بلا Chrome تفتح في Custom Tab
  عادي (تدهور آمن).
- لا إشعارات Push في هذه المرحلة (`enableNotifications: false`).
- لا يعمل التطبيق بلا إنترنت (لا Offline Accounting) — صفحة عدم الاتصال تظهر كما في المتصفح.
- لم يُختبر التثبيت أو التحقق من الأصول على جهاز فعلي بعد؛ هذا يتطلب جهاز Android ومفتاحك.
