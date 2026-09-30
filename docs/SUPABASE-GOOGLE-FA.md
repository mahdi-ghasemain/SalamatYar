# راهنمای گام‌به‌گام ورود واقعی (Supabase + گوگل)

این راهنما فقط کارهایی را می‌گوید که **خودت** باید با حساب خودت انجام بدهی. تا این‌ها کامل نشود، دکمه‌های ثبت‌نام و «ورود با گوگل» در برنامه عمداً غیرفعال می‌مانند و هیچ داده ساختگی جابه‌جا نمی‌شود.

پیش‌نیاز: حساب [Supabase](https://supabase.com/dashboard)، حساب [Google Cloud](https://console.cloud.google.com)، و Node.js.

---

## ۱) ساخت پروژه Supabase

1. در داشبورد Supabase → **New project**.
2. نام پروژه و یک **رمز دیتابیس** بگذار (رمز را جایی امن نگه دار).
3. **Region** را نزدیک محل کاربران انتخاب کن (برای ایران معمولاً یک منطقه اروپایی/خاورمیانه مناسب است).
4. بعد از ساخته‌شدن پروژه، از **Project Settings → Data API / API** مقدار **Project URL** را بردار: `https://<ref>.supabase.co`

## ۲) اجرای migrationها (ساخت جدول‌ها و امنیت)

در **SQL Editor → New query** این سه فایل را به ترتیب اجرا کن (هر بار Paste و Run):

1. `supabase/migrations/202609300001_health.sql`
2. `supabase/migrations/202609300002_scale.sql`
3. `supabase/migrations/202610010001_scale.sql`

این‌ها جدول‌های سلامت، سیاست‌های **RLS** (جداسازی حساب‌ها)، توابع `load_health_state` / `save_health_state`، باکت خصوصی فایل‌ها و کش نقشه را می‌سازند. همه با `if not exists` نوشته شده‌اند و اجرای دوباره ضرری ندارد.

> جایگزین با CLI: `npx supabase link --project-ref <ref>` و بعد `npx supabase db push`.

## ۳) کلید عمومی و فایل `.env.local`

1. از **Project Settings → API Keys** کلید **Publishable key** (`sb_publishable_...`) را کپی کن.
2. در ریشه‌ی پوشه‌ی پروژه (کنار `package.json`) فایل `.env.local` بساز:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_NEARBY_FUNCTION=nearby
```

3. بررسی خودکار: `npm run verify:auth`

> ⚠️ هرگز کلید `service_role` یا Google Client Secret را داخل اپ نگذار. `.env.local` در `.gitignore` است و کامیت نمی‌شود.

## ۴) تنظیمات ورود با ایمیل

در داشبورد → **Authentication**:

1. **Providers → Email**: فعال باشد.
2. **Confirm email**: برای انتشار روشن باشد (کاربر باید ایمیل تأیید را باز کند).
3. **Password → Minimum length**: روی **۱۲** بگذار (خود اپ هم ۱۲ نویسه چک می‌کند).
4. **Rate limits**: سقف ثبت‌نام و ارسال ایمیل را متناسب با ظرفیت تنظیم کن.
5. **SMTP**: برای انتشار، SMTP اختصاصی خودت را در **Project Settings → Auth → SMTP Settings** وارد کن؛ حالت پیش‌فرض برای تست است، نه برای تعداد زیاد کاربر.

## ۵) آدرس‌های بازگشت (Redirect URLs)

در **Authentication → URL Configuration** این‌ها را به **Redirect URLs** اضافه کن:

- `salamatyar://auth/callback` ← اپ اندروید ساخته‌شده
- `http://localhost:8081/auth/callback` ← فقط برای توسعه‌ی وب
- `https://<YOUR_DOMAIN>/auth/callback` ← نسخه‌ی وب نهایی

و **Site URL** را آدرس اصلی برنامه بگذار. (Scheme در `app.json` برابر `salamatyar` است.)

## ۶) ورود با گوگل

1. **Google Cloud Console → APIs & Services → OAuth consent screen**: نوع **External**؛ نام، لوگو، دامنه و ایمیل پشتیبانی را پر کن. تا زمانی که Publish نکرده‌ای، کاربران تستت را در بخش Test users اضافه کن.
2. **Credentials → Create Credentials → OAuth client ID → Web application**.
3. در **Authorized redirect URIs** این آدرس را دقیقاً وارد کن:
   `https://<ref>.supabase.co/auth/v1/callback`
4. **Client ID** و **Client Secret** را در **Supabase → Authentication → Providers → Google** وارد کن و Provider را **Enable** کن.
5. اپ از PKCE و مرورگر سیستم استفاده می‌کند؛ رمز گوگل داخل اپ دریافت نمی‌شود.

> اگر خطای `redirect_uri_mismatch` دیدی، یعنی آدرس بالا دقیقاً مطابق نیست.

## ۷) (اختیاری) تابع ابری نقشه

بدون این هم نقشه و فهرست رایگان مستقیم کار می‌کند؛ این تابع فقط کش سمت سرور و سقف منصفانه اضافه می‌کند:

```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase functions deploy nearby
npx supabase secrets set OVERPASS_URL=https://<your-overpass-endpoint>
```

## ۸) آزمون ورود واقعی

1. `npm run verify:auth` → باید پروژه، ایمیل و گوگل را سبز نشان دهد.
2. `npx expo start --clear` (اگر سرور قدیمی باز است، حتماً `--clear`).
3. در برنامه: **ورود / ثبت‌نام**:
   - **ثبت‌نام**: ایمیل + رمز ۱۲+ نویسه → ایمیل تأیید را باز کن → برگرد و **ورود** کن.
   - **ورود با گوگل**: پنجره مرورگر باز می‌شود → حساب را انتخاب کن → به اپ برمی‌گردی.
   - **بازیابی رمز**: لینک ایمیل → تعیین رمز جدید.
4. بعد از ورود، یک دارو اضافه کن؛ در تنظیمات باید «وضعیت ذخیره» روی `saved` برود.
5. `npm test` (تست‌های پایگاه‌داده روی PostgreSQL تعبیه‌شده).

### چک‌لیست نهایی پیش از انتشار
- [ ] `npm run typecheck` و `npm run lint` سبز
- [ ] `npm test` سبز
- [ ] ثبت‌نام/تأیید ایمیل/ورود گوگل روی سرویس واقعی تست‌شده
- [ ] جداسازی حساب دوم (کاربر دیگر داده‌ی تو را نمی‌بیند)
- [ ] خروج از حساب و انقضای نشست
- [ ] پیوست مدرک، حذف و بازیابی پشتیبان
- [ ] اعلان روی گوشی واقعی
- [ ] مجوز دوربین و مکان

## ۹) ساخت خروجی اندروید

```
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

پروفایل `preview` خروجی APK می‌دهد. پس از افزودن مجوز دوربین/مکان، build جدید لازم است.

## رفع اشکال

| نشانه | علت و راه‌حل |
|---|---|
| پیام «برای فعال شدن ثبت‌نام… Supabase» | `.env.local` تنظیم نشده یا برنامه restart نشده؛ `npx expo start --clear` |
| `No authentication code was returned` | Redirect URL در Supabase با `salamatyar://auth/callback` یا `http://localhost:8081/auth/callback` نمی‌خوابد |
| ایمیل تأیید نمی‌آید | SMTP تنظیم نشده یا سقف ارسال پر شده |
| `redirect_uri_mismatch` گوگل | آدرس `https://<ref>.supabase.co/auth/v1/callback` در گوگل دقیقاً ثبت نشده |
| `VERSION_CONFLICT` | تغییر همزمان دو دستگاه؛ اول پشتیبان بگیر و «بارگیری آخرین نسخه» را بزن |
| دکمه‌ها کار نمی‌کنند ولی کد جدید است | سرور قدیمی باز است؛ `npx expo start --clear` |

منابع: [Supabase Auth (React Native)](https://supabase.com/docs/guides/auth/quickstarts/react-native) · [ورود با Google](https://supabase.com/docs/guides/auth/social-login/auth-google) · [Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
