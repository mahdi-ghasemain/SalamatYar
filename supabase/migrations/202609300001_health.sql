-- Run once with Supabase migrations. Browser clients only receive the publishable key.
create table public.health_accounts (
  owner uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}',
  version bigint not null default 0,
  updated_at timestamptz not null default '-infinity'
);
create table public.health_entries (
  owner uuid not null references public.health_accounts(owner) on delete cascade,
  kind text not null check (kind in ('members','medicines','appointments','records','metrics')),
  id text not null check (length(id) between 1 and 160),
  data jsonb not null check (jsonb_typeof(data)='object'),
  primary key (owner,kind,id)
);
alter table public.health_accounts enable row level security;
alter table public.health_entries enable row level security;
create policy own_account_read on public.health_accounts for select to authenticated using (owner=(select auth.uid()));
create policy own_entries_read on public.health_entries for select to authenticated using (owner=(select auth.uid()));
revoke all on public.health_accounts,public.health_entries from anon,authenticated;
grant select on public.health_accounts,public.health_entries to authenticated;

create function public.load_health_state(expected_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare account public.health_accounts; result jsonb; kind_name text;
begin
  if auth.uid() is null or expected_owner is distinct from auth.uid() then raise exception 'UNAUTHORIZED'; end if;
  insert into public.health_accounts(owner) values(auth.uid()) on conflict do nothing;
  -- A shared lock keeps version and all entry arrays from the same snapshot.
  select * into account from public.health_accounts where owner=auth.uid() for share;
  result:=account.preferences;
  foreach kind_name in array array['members','medicines','appointments','records','metrics'] loop
    result:=result||jsonb_build_object(kind_name,coalesce((select jsonb_agg(data order by id) from public.health_entries where owner=auth.uid() and kind=kind_name),case when kind_name='members' then '[{"id":"self","name":"","relation":""}]'::jsonb else '[]'::jsonb end));
  end loop;
  return jsonb_build_object('state',result,'version',account.version);
end $$;

create function public.save_health_state(payload jsonb,expected_version bigint,expected_owner uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare account public.health_accounts; kind_name text; entries jsonb; item jsonb; next_version bigint;
begin
  if auth.uid() is null or expected_owner is distinct from auth.uid() then raise exception 'UNAUTHORIZED'; end if;
  if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>2000000 then raise exception 'PAYLOAD_LIMIT'; end if;
  insert into public.health_accounts(owner) values(auth.uid()) on conflict do nothing;
  select * into account from public.health_accounts where owner=auth.uid() for update;
  if account.version<>expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if account.updated_at>clock_timestamp()-interval '250 milliseconds' then raise exception 'RATE_LIMIT'; end if;
  if not exists(select 1 from jsonb_array_elements(payload->'members') m where m->>'id'='self') then raise exception 'SELF_PROFILE_REQUIRED'; end if;
  foreach kind_name in array array['members','medicines','appointments','records','metrics'] loop
    entries:=payload->kind_name;
    if entries is null or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries)>5000 then raise exception 'INVALID_ENTRIES'; end if;
    if (select count(*) from jsonb_array_elements(entries))<>(select count(distinct e->>'id') from jsonb_array_elements(entries) e) then raise exception 'DUPLICATE_ID'; end if;
    for item in select value from jsonb_array_elements(entries) loop
      if jsonb_typeof(item)<>'object' or coalesce(length(item->>'id'),0) not between 1 and 160 then raise exception 'INVALID_ENTRY'; end if;
      if kind_name<>'members' and not exists(select 1 from jsonb_array_elements(payload->'members') m where m->>'id'=item->>'memberId') then raise exception 'INVALID_MEMBER'; end if;
      if kind_name='medicines' then item:=item-'notificationId'; end if;
      insert into public.health_entries(owner,kind,id,data) values(auth.uid(),kind_name,item->>'id',item)
      on conflict (owner,kind,id) do update set data=excluded.data where public.health_entries.data is distinct from excluded.data;
    end loop;
    delete from public.health_entries where owner=auth.uid() and kind=kind_name and id not in(select e->>'id' from jsonb_array_elements(entries) e);
  end loop;
  update public.health_accounts set preferences=jsonb_build_object('language',case when payload->>'language'='en' then 'en' else 'fa' end,'calendar',case when payload->>'calendar'='gregory' then 'gregory' else 'persian' end,'theme',case when payload->>'theme'='dark' then 'dark' else 'light' end,'welcomed',true),version=version+1,updated_at=clock_timestamp() where owner=auth.uid() returning version into next_version;
  return next_version;
end $$;
revoke all on function public.load_health_state(uuid),public.save_health_state(jsonb,bigint,uuid) from public;
grant execute on function public.load_health_state(uuid),public.save_health_state(jsonb,bigint,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('health-records','health-records',false,10485760,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
create policy own_file_read on storage.objects for select to authenticated using(bucket_id='health-records' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy own_file_insert on storage.objects for insert to authenticated with check(bucket_id='health-records' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy own_file_delete on storage.objects for delete to authenticated using(bucket_id='health-records' and (storage.foldername(name))[1]=(select auth.uid()::text));

create table public.nearby_cache (cell text primary key, data jsonb not null, expires_at timestamptz not null);
create table public.nearby_limits (owner uuid primary key references auth.users(id) on delete cascade, window_start timestamptz not null, hits integer not null);
alter table public.nearby_cache enable row level security;
alter table public.nearby_limits enable row level security;
revoke all on public.nearby_cache,public.nearby_limits from anon,authenticated;
create function public.allow_nearby_request(request_owner uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.nearby_limits(owner,window_start,hits) values(request_owner,now(),1)
 on conflict(owner) do update set hits=case when public.nearby_limits.window_start<now()-interval '1 minute' then 1 else public.nearby_limits.hits+1 end,window_start=case when public.nearby_limits.window_start<now()-interval '1 minute' then now() else public.nearby_limits.window_start end returning hits into n;
 return n<=6;
end $$;
revoke all on function public.allow_nearby_request(uuid) from public;
grant execute on function public.allow_nearby_request(uuid) to service_role;
