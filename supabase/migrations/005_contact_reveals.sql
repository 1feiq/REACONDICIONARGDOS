begin;
create table private.contact_reveals (
 user_id uuid not null references public.users(id) on delete cascade,
 device_id uuid not null references public.devices(id) on delete cascade,
 revealed_at timestamptz not null default now(),
 primary key(user_id, device_id)
);
create index contact_reveals_window on private.contact_reveals(user_id,revealed_at);
alter table private.contact_reveals enable row level security;
revoke all on private.contact_reveals from public,anon,authenticated;
drop policy contact_read on public.device_contacts;
create policy contact_read on public.device_contacts for select to authenticated
using(private.is_admin() or exists(select 1 from public.devices d where d.id=device_id and d.owner_id=auth.uid()));

create function public.reveal_contact(p_device uuid)
returns table(contact_name text, whatsapp_e164 text, contact_email text)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); own_contact boolean;
begin
 if actor is null then raise exception 'authentication_required'; end if;
 select d.owner_id=actor into own_contact from public.devices d where d.id=p_device;
 if private.is_admin() or coalesce(own_contact,false) then
   return query select c.contact_name,c.whatsapp_e164,c.contact_email from public.device_contacts c where c.device_id=p_device;
   return;
 end if;
 if not private.has_access() then raise exception 'subscription_required'; end if;
 if not exists(select 1 from public.devices d join public.device_contacts c on c.device_id=d.id
   where d.id=p_device and d.status='publicado' and c.permission_confirmed_at is not null)
 then raise exception 'contact_unavailable'; end if;
 -- Serialize each user's reveals, including concurrent requests from multiple tabs.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 if not exists(select 1 from private.contact_reveals r where r.user_id=actor and r.device_id=p_device and r.revealed_at>now()-interval '24 hours') then
   if (select count(*) from private.contact_reveals r where r.user_id=actor and r.revealed_at>now()-interval '24 hours')>=30 then
     raise exception 'contact_daily_limit';
   end if;
   insert into private.contact_reveals(user_id,device_id,revealed_at) values(actor,p_device,now())
   on conflict(user_id,device_id) do update set revealed_at=excluded.revealed_at;
 end if;
 return query select c.contact_name,c.whatsapp_e164,c.contact_email from public.device_contacts c where c.device_id=p_device;
end;$$;
revoke all on function public.reveal_contact(uuid) from public,anon,authenticated;
grant execute on function public.reveal_contact(uuid) to authenticated;
commit;
