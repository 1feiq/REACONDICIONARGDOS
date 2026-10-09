begin;
create table public.listing_alerts (
 user_id uuid primary key references public.users(id) on delete cascade,
 category text not null default 'todas' check(category in ('todas','celular','notebook','consola')),
 enabled boolean not null default true,
 seen_at timestamptz not null default now()
);
alter table public.listing_alerts enable row level security;
revoke all on public.listing_alerts from anon,authenticated;
grant select,insert,update,delete on public.listing_alerts to authenticated;
grant all on public.listing_alerts to service_role;
create policy own_alerts on public.listing_alerts for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
create index devices_alerts on public.devices(published_at desc) where status='publicado';
commit;
