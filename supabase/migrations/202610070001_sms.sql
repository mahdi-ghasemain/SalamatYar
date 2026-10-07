-- SMS login support (Iranian provider, e.g. LimoSMS).
-- Codes are held by the SMS provider (sendcode/checkcode); here we only keep
-- rate-limit counters and the phone -> auth user mapping. The Edge Function
-- uses the service_role key and bypasses RLS; no client may read these tables.
create table if not exists public.sms_limits (
  phone text not null,
  kind text not null check (kind in ('send', 'verify')),
  window_start timestamptz not null,
  hits integer not null,
  primary key (phone, kind)
);
create table if not exists public.sms_accounts (
  phone text primary key check (phone ~ '^09[0-9]{9}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sms_limits enable row level security;
alter table public.sms_accounts enable row level security;
revoke all on public.sms_limits, public.sms_accounts from anon, authenticated;

-- Hourly per-number rate limiter for SMS actions. Called with service_role.
create or replace function public.allow_sms_request(request_phone text, request_kind text, request_limit integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if request_phone !~ '^09[0-9]{9}$' or request_kind not in ('send', 'verify') or request_limit < 1 then
    return false;
  end if;
  insert into public.sms_limits(phone, kind, window_start, hits)
  values (request_phone, request_kind, now(), 1)
  on conflict (phone, kind) do update set
    hits = case when public.sms_limits.window_start < now() - interval '1 hour' then 1 else public.sms_limits.hits + 1 end,
    window_start = case when public.sms_limits.window_start < now() - interval '1 hour' then now() else public.sms_limits.window_start end
  returning hits into n;
  return n <= request_limit;
end $$;
revoke all on function public.allow_sms_request(text, text, integer) from public;
grant execute on function public.allow_sms_request(text, text, integer) to service_role;
