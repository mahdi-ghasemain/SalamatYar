-- Scale hardening: index hot paths and expire nearby cache.
-- Run once in SQL Editor. Safe to re-run (IF NOT EXISTS).
create index if not exists health_entries_owner_kind_idx
  on public.health_entries (owner, kind);
create index if not exists nearby_cache_expires_idx
  on public.nearby_cache (expires_at);
-- Periodic cleanup (schedule via pg_cron or dashboard):
-- delete from public.nearby_cache where expires_at < now();
-- delete from public.nearby_limits where window_start < now() - interval '1 day';
