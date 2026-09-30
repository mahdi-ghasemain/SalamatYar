-- Follow-up to 202609300001_health.sql. Safe to run on an existing project.
-- Keeps the two shared nearby tables bounded so a growing user base does not
-- accumulate expired cache cells and idle rate-limit rows forever.
create index if not exists nearby_cache_expires_idx on public.nearby_cache(expires_at);
create index if not exists nearby_limits_window_idx on public.nearby_limits(window_start);

create or replace function public.allow_nearby_request(request_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 -- Opportunistic cleanup: a small share of requests removes expired cache
 -- cells and idle rate-limit rows, so no scheduled job is strictly required.
 if random() < 0.02 then
  delete from public.nearby_cache where expires_at < now();
  delete from public.nearby_limits where window_start < now() - interval '1 day';
 end if;
 insert into public.nearby_limits(owner,window_start,hits) values(request_owner,now(),1)
 on conflict(owner) do update set hits=case when public.nearby_limits.window_start<now()-interval '1 minute' then 1 else public.nearby_limits.hits+1 end,window_start=case when public.nearby_limits.window_start<now()-interval '1 minute' then now() else public.nearby_limits.window_start end returning hits into n;
 return n<=6;
end $$;
revoke all on function public.allow_nearby_request(uuid) from public;
grant execute on function public.allow_nearby_request(uuid) to service_role;
