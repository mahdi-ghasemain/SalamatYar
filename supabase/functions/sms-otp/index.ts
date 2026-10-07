import { createClient } from 'npm:@supabase/supabase-js@2';

// SMS one-time-code login for Iranian numbers via LimoSMS.
// The provider holds the codes (sendcode/checkcode); this function only
// rate-limits, relays, and mints a Supabase session for verified numbers.
// The LimoSMS ApiKey stays server-side: never put it in the app.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PHONE_RE = /^09\d{9}$/;
const SEND_LIMIT = 3; // codes per hour per number
const VERIFY_LIMIT = 10; // attempts per hour per number
const DERIVED_DOMAIN = 'sms.salamatyar.local';

function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const latin = raw
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[\s-]/g, '');
  const digits = latin.startsWith('+98') ? '0' + latin.slice(3) : latin.startsWith('98') ? '0' + latin.slice(2) : latin;
  return PHONE_RE.test(digits) ? digits : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'METHOD' }, 405);
  let body: { action?: string; phone?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'BAD_REQUEST' }, 400);
  }
  const phone = normalizePhone(body.phone);
  if (!phone || (body.action !== 'send' && body.action !== 'verify')) return reply({ error: 'BAD_REQUEST' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const apiKey = Deno.env.get('LIMOSMS_API_KEY');
  if (!apiKey) return reply({ error: 'SMS_NOT_CONFIGURED' }, 503);

  // Hourly rate limit per number and action. Generic reply avoids number enumeration.
  const { data: limited, error: limitError } = await admin.rpc('allow_sms_request', {
    request_phone: phone,
    request_kind: body.action,
    request_limit: body.action === 'send' ? SEND_LIMIT : VERIFY_LIMIT,
  });
  if (limitError) return reply({ error: 'LIMIT_ERROR' }, 500);
  if (limited !== true) return reply({ error: 'RATE_LIMIT' }, 429);

  if (body.action === 'send') {
    const res = await fetch('https://api.limosms.com/api/sendcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ApiKey: apiKey },
      body: JSON.stringify({ Mobile: phone, Footer: 'سلامت‌یار' }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    const result = await res?.json().catch(() => null);
    if (!res || res.ok !== true || result?.Success !== true) return reply({ error: 'PROVIDER_UNAVAILABLE' }, 502);
    return reply({ ok: true });
  }

  // verify
  const code = typeof body.code === 'string' ? body.code.replace(/[^0-9۰-۹٠-٩]/g, '').slice(0, 8) : '';
  if (!code) return reply({ error: 'BAD_REQUEST' }, 400);
  const res = await fetch('https://api.limosms.com/api/checkcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ApiKey: apiKey },
    body: JSON.stringify({ Mobile: phone, Code: code }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const result = await res?.json().catch(() => null);
  if (!res || res.ok !== true || result?.Success !== true) return reply({ error: 'INVALID_CODE' }, 400);

  const email = `${phone}@${DERIVED_DOMAIN}`;
  let { data: mapping } = await admin.from('sms_accounts').select('user_id').eq('phone', phone).maybeSingle();
  if (!mapping) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { phone, login: 'sms' },
    });
    if (createError || !created.user) {
      // Number verified but account linking failed; do not leak details.
      return reply({ error: 'ACCOUNT_ERROR' }, 500);
    }
    const { error: mapError } = await admin.from('sms_accounts').insert({ phone, user_id: created.user.id });
    if (mapError) return reply({ error: 'ACCOUNT_ERROR' }, 500);
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: 'salamatyar://auth/callback' },
  });
  if (linkError || !link.properties?.action_link) return reply({ error: 'ACCOUNT_ERROR' }, 500);
  return reply({ link: link.properties.action_link, email });
});
