begin;
-- Preserve all historical records; retire every financial command.
update private.commerce_config set enabled=false;
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('apply_payment','apply_legacy_payment','apply_pro_payment','apply_commerce_event','create_protected_order','order_action','admin_commerce_action','founder_availability') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end;$$;
revoke insert,update,delete on public.subscriptions,public.subscription_payments,public.founder_slots,public.protected_orders,public.financial_events,public.financial_requests from service_role;
drop policy subscription_read on public.subscriptions;
drop policy payment_read on public.subscription_payments;
drop policy founder_read on public.founder_slots;
create policy archived_subscription_admin on public.subscriptions for select to authenticated using(private.is_admin());
create policy archived_payment_admin on public.subscription_payments for select to authenticated using(private.is_admin());
create policy archived_founder_admin on public.founder_slots for select to authenticated using(private.is_admin());
alter table public.users drop constraint users_city_check,drop constraint users_province_check;
alter table public.devices drop constraint devices_city_check,drop constraint devices_province_check;
alter table public.users alter column city drop default,alter column province drop default;
alter table public.devices alter column city drop default,alter column province drop default;
alter table public.users add constraint city_length check(length(trim(city)) between 2 and 80),add constraint province_length check(length(trim(province)) between 2 and 80);
alter table public.devices add constraint city_length check(length(trim(city)) between 2 and 80),add constraint province_length check(length(trim(province)) between 2 and 80);
alter table public.devices add column moderation_status text not null default 'pending' check(moderation_status in ('pending','approved','rejected')),
 add column ad_eligible boolean not null default false;
alter table public.device_contacts add column contact_scope text not null default 'legacy_paid' check(contact_scope in ('legacy_paid','registered_free'));
create table public.market_categories(code text primary key,label text not null check(length(label) between 2 and 50),enabled boolean not null default true);
insert into public.market_categories values('celular','Celulares',true),('notebook','Notebooks',true),('consola','Consolas',true);
create table public.ad_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false,home boolean not null default true,search boolean not null default true,device boolean not null default true,guides boolean not null default true);
insert into public.ad_settings(singleton) values(true);
alter table public.market_categories enable row level security;
alter table public.ad_settings enable row level security;
grant select on public.market_categories,public.ad_settings to anon,authenticated;
revoke insert,update,delete on public.market_categories,public.ad_settings from anon,authenticated;
grant all on public.market_categories,public.ad_settings to service_role;
create policy category_read on public.market_categories for select using(true);
create policy ad_settings_read on public.ad_settings for select using(true);
create index devices_region on public.devices(province,city,published_at desc) where status='publicado' and moderation_status='approved';
create index specs_price on public.device_specs(asking_price);
drop policy device_read on public.devices;
create policy device_read on public.devices for select using((status='publicado' and moderation_status='approved') or owner_id=auth.uid() or private.is_admin());
create or replace function private.handle_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.users(id,display_name,role,city,province)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Usuario'),100),
 case when new.raw_user_meta_data->>'role'='tecnico' then 'tecnico' else 'cliente' end,
 left(coalesce(nullif(trim(new.raw_user_meta_data->>'city'),''),'Sin indicar'),80),
 left(coalesce(nullif(trim(new.raw_user_meta_data->>'province'),''),'Sin indicar'),80));
 return new;
end;$$;
-- Free access is based on authenticated account safety, never on payment.
create or replace function private.has_access() returns boolean language sql stable security definer set search_path='' as $$select private.account_enabled()$$;
create or replace function public.save_device(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); d uuid; old public.devices; spec jsonb:=p->'specs'; photos text[]; admin boolean:=private.is_admin(); permission boolean:=coalesce((p->>'permission')::boolean,false);
begin
 if not private.account_enabled() then raise exception 'authentication_required'; end if;
 if p->>'country_code' is distinct from 'AR' or length(trim(p->>'city')) not between 2 and 80 or length(trim(p->>'province')) not between 2 and 80 then raise exception 'argentina_required'; end if;
 if not exists(select 1 from public.market_categories where code=p->>'category' and enabled) then raise exception 'category_unavailable'; end if;
 if p->>'status' not in ('borrador','publicado') then raise exception 'invalid_status'; end if;
 if p->>'status'='publicado' and not permission then raise exception 'permission_required'; end if;
 select coalesce(array_agg(value),'{}') into photos from jsonb_array_elements_text(coalesce(p->'photo_paths','[]'));
 if cardinality(photos) not between 1 and 6 or exists(select 1 from unnest(photos) x where x not like actor::text||'/%') then raise exception 'invalid_photos'; end if;
 if spec is null then raise exception 'specifications_required'; end if;
 if p->>'intent'<>'reparar' and nullif(spec->>'asking_price','') is null then raise exception 'price_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,212));
 if nullif(p->>'id','') is not null then
  select * into old from public.devices where id=(p->>'id')::uuid for update;
  if not found or old.owner_id is distinct from actor then raise exception 'not_owner'; end if;
  d:=old.id;
  update public.devices set category=p->>'category',brand=trim(p->>'brand'),model=trim(p->>'model'),intent=p->>'intent',fault_code=p->>'fault_code',description=p->>'description',photo_paths=photos,status=p->>'status',city=trim(p->>'city'),province=trim(p->>'province'),neighborhood=nullif(p->>'neighborhood',''),moderation_status='pending',ad_eligible=false,updated_at=now() where id=d;
 else
  if (select count(*) from public.devices where created_by=actor and created_at>now()-interval '1 day')>=10 then raise exception 'daily_publication_limit'; end if;
  if exists(select 1 from public.devices where created_by=actor and lower(brand)=lower(trim(p->>'brand')) and lower(model)=lower(trim(p->>'model')) and description=p->>'description' and status not in ('archivado','cerrado')) then raise exception 'duplicate_listing'; end if;
  insert into public.devices(owner_id,created_by,category,brand,model,intent,fault_code,description,photo_paths,status,source,neighborhood,city,province,country_code,published_at)
  values(case when admin and p->>'source'='admin' then null else actor end,actor,p->>'category',trim(p->>'brand'),trim(p->>'model'),p->>'intent',p->>'fault_code',p->>'description',photos,p->>'status',case when admin and p->>'source'='admin' then 'admin' else 'usuario' end,nullif(p->>'neighborhood',''),trim(p->>'city'),trim(p->>'province'),'AR',case when p->>'status'='publicado' then now() end) returning id into d;
 end if;
 insert into public.device_contacts(device_id,contact_name,whatsapp_e164,contact_email,source_url,permission_confirmed_at,contact_scope)
 values(d,p->>'contact_name',nullif(p->>'whatsapp_e164',''),nullif(p->>'contact_email',''),case when admin then nullif(p->>'source_url','') end,case when permission then now() end,'registered_free')
 on conflict(device_id) do update set contact_name=excluded.contact_name,whatsapp_e164=excluded.whatsapp_e164,contact_email=excluded.contact_email,permission_confirmed_at=excluded.permission_confirmed_at,contact_scope='registered_free',updated_at=now();
 insert into public.device_specs(device_id,storage_capacity,physical_condition,power_on,screen,battery,motherboard,activation_lock,previous_repairs,asking_price,accepts_offers,delivery)
 values(d,spec->>'storage_capacity',spec->>'physical_condition',spec->>'power_on',spec->>'screen',spec->>'battery',spec->>'motherboard',spec->>'activation_lock',spec->>'previous_repairs',nullif(spec->>'asking_price','')::numeric,coalesce((spec->>'accepts_offers')::boolean,true),spec->>'delivery')
 on conflict(device_id) do update set storage_capacity=excluded.storage_capacity,physical_condition=excluded.physical_condition,power_on=excluded.power_on,screen=excluded.screen,battery=excluded.battery,motherboard=excluded.motherboard,activation_lock=excluded.activation_lock,previous_repairs=excluded.previous_repairs,asking_price=excluded.asking_price,accepts_offers=excluded.accepts_offers,delivery=excluded.delivery,declared_at=now();
 if coalesce(p->>'identifier','')<>'' then insert into public.device_identifiers values(d,p->>'identifier',p->>'identifier_kind') on conflict(device_id) do update set identifier=excluded.identifier,kind=excluded.kind; end if;
 return d;
end;$$;
revoke all on function public.save_basic_device(jsonb) from public,anon,authenticated,service_role;
create or replace function public.confirm_and_publish(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'forbidden'; end if;
 update public.device_contacts set permission_confirmed_at=now(),contact_scope='registered_free',updated_at=now() where device_id=p_id;
 perform public.set_device_status(p_id,'publicado');
end;$$;
commit;
