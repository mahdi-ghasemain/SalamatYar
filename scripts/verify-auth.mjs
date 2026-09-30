// Verifies the Supabase configuration used for real sign-up / Google sign-in.
// Run after creating .env.local:  npm run verify:auth
// It only reads the public publishable key and never prints secrets.
import { readFile } from "node:fs/promises";

const ENV_FILES = [".env.local", ".env.development.local", ".env"];

async function loadEnv() {
  const values = {};
  for (const file of ENV_FILES) {
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || values[match[1]] !== undefined) continue;
      values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return values;
}

const ok = (label, detail = "") =>
  console.log(`  \u2705 ${label}${detail ? ` \u2014 ${detail}` : ""}`);
const bad = (label, detail = "") => {
  console.log(`  \u274C ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  process.exitCode = 1;
};
const warn = (label, detail = "") =>
  console.log(`  \u26A0\uFE0F  ${label}${detail ? ` \u2014 ${detail}` : ""}`);

const env = await loadEnv();
const url = (env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
const key = (env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
const fnName = (env.EXPO_PUBLIC_NEARBY_FUNCTION || "nearby").trim();

console.log(
  "\n\u0628\u0631\u0631\u0633\u06CC \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648\u0631\u0648\u062F / SalamatYar auth check\n",
);

const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);
if (!url) bad("EXPO_PUBLIC_SUPABASE_URL", "در .env.local تنظیم نشده");
else if (!urlOk) bad("EXPO_PUBLIC_SUPABASE_URL", `قالب نامعتبر: ${url}`);
else ok("EXPO_PUBLIC_SUPABASE_URL", url.replace(/\/$/, ""));

const keyOk =
  key.length > 30 &&
  !key.includes("REPLACE_ME") &&
  !key.startsWith("sb_secret_");
if (!key)
  bad("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "در .env.local تنظیم نشده");
else if (key.startsWith("sb_secret_"))
  bad(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "کلید secret هرگز نباید داخل اپ باشد",
  );
else if (!keyOk)
  bad("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "کلید عمومی معتبر نیست");
else ok("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", `${key.slice(0, 14)}\u2026`);

if (!urlOk || !keyOk) {
  console.log(
    "\n\u0641\u0627\u06CC\u0644 .env.local \u0628\u0633\u0627\u0632 (\u06A9\u0646\u0627\u0631 package.json):\n" +
      "  EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co\n" +
      "  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...\n" +
      "\u0633\u067E\u0633: npm run verify:auth\n" +
      "\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u06A9\u0627\u0645\u0644: docs/SUPABASE-GOOGLE-FA.md\n",
  );
  process.exit(1);
}

const base = url.replace(/\/$/, "");
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const request = async (path, init = {}) => {
  const res = await fetch(base + path, { headers: { ...headers }, ...init });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

// 1) Project reachable and which providers are enabled.
try {
  const { status, body } = await request("/auth/v1/settings");
  if (status !== 200) bad("اتصال به پروژه با کلید عمومی", `HTTP ${status}`);
  else {
    ok("اتصال به پروژه با کلید عمومی", "پاسخ Auth دریافت شد");
    const external = body?.external || {};
    console.log("  \u2500\u2500 ارائه‌دهنده‌ها \u2500\u2500");
    (external.email ? ok : bad)(
      "ورود با ایمیل",
      external.email ? "فعال" : "Authentication → Providers → Email را فعال کن",
    );
    (external.google ? ok : warn)(
      "ورود با گوگل",
      external.google ? "فعال" : "برای گوگل، Provider را در Supabase فعال کن",
    );
    if (body?.mailer_autoconfirm)
      warn("تأیید ایمیل", "خودکار است؛ برای انتشار خاموش کن");
    if (body?.disable_signup) bad("ثبت‌نام", "ثبت‌نام در Auth غیرفعال است");
  }
} catch (error) {
  bad("اتصال به پروژه", error.message);
}

// 2) REST / PostgREST reachable once migrations are applied.
try {
  const { status } = await request("/rest/v1/");
  if (status === 200) ok("REST و Postgres", "در دسترس");
  else warn("REST و Postgres", `HTTP ${status}`);
} catch (error) {
  warn("REST و Postgres", error.message);
}

// 3) Anonymous users must not read any health rows.
try {
  const { status, body } = await request(
    "/rest/v1/health_entries?select=id&limit=1",
  );
  if (status === 200 && Array.isArray(body) && body.length > 0)
    bad("جداسازی حساب‌ها", "کاربر ناشناس به داده دسترسی دارد!");
  else if (status === 404)
    bad("جدول‌ها", "migration اجرا نشده (جدول پیدا نشد)");
  else ok("جداسازی حساب‌ها", "دسترسی ناشناس مسدود است");
} catch (error) {
  warn("جداسازی حساب‌ها", error.message);
}

// 4) Optional nearby function.
try {
  const res = await fetch(`${base}/functions/v1/${fnName}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ lat: 0, lon: 0 }),
  });
  if (res.status === 401) ok("تابع nearby", "منتشر شده و احراز هویت لازم است");
  else if (res.status === 404)
    warn("تابع nearby", "منتشر نشده (اختیاری؛ نقشه بدون آن هم کار می‌کند)");
  else warn("تابع nearby", `HTTP ${res.status}`);
} catch (error) {
  warn("تابع nearby", error.message);
}

console.log(
  `\nنتیجه: ${process.exitCode ? "موارد بالا را اصلاح کن." : "آماده‌ی ثبت‌نام و ورود واقعی است."}`,
);
console.log("سپس: npx expo start --clear و صفحه‌ی «ورود / ثبت‌نام».\n");
