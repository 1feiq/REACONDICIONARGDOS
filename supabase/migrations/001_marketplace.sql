begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 100),
 role text not null default 'cliente' check(role in ('cliente','tecnico','admin')),
 city text not null default 'Rosario' check(city='Rosario'),
 province text not null default 'Santa Fe' check(province='Santa Fe'),
 country_code text not null default 'AR' check(country_code='AR'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function private.handle_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.users(id,display_name,role) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Usuario'),100),case when new.raw_user_meta_data->>'role'='tecnico' then 'tecnico' else 'cliente' end);
 return new;
end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_signup();
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.users where id=auth.uid() and role='admin')$$;

create table public.devices (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references public.users(id) on delete set null,
 created_by uuid references public.users(id) on delete set null,
 category text not null check(category in ('celular','notebook','consola')),
 brand text not null check(length(brand) between 1 and 60), model text not null check(length(model) between 1 and 100),
 intent text not null check(intent in ('vender','reparar','ambas')),
 fault_code text not null check(fault_code in ('pantalla_rota','bateria','no_enciende','carga','otro')),
 description text not null check(length(description) between 15 and 2000),
 photo_paths text[] not null default '{}' check(cardinality(photo_paths)<=6),
 status text not null default 'borrador' check(status in ('borrador','publicado','cerrado','archivado')),
 source text not null check(source in ('usuario','admin')),
 neighborhood text check(length(neighborhood)<=80),
 city text not null default 'Rosario' check(city='Rosario'), province text not null default 'Santa Fe' check(province='Santa Fe'), country_code text not null default 'AR' check(country_code='AR'),
 published_at timestamptz, closed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.device_contacts (
 device_id uuid primary key references public.devices(id) on delete cascade,
 contact_name text not null check(length(contact_name) between 2 and 100),
 whatsapp_e164 text check(whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 contact_email text check(length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 source_url text check(source_url is null or source_url ~ '^https://'),
 permission_confirmed_at timestamptz, last_verified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(whatsapp_e164 is not null or contact_email is not null)
);
create table public.pricing_catalog (
 id uuid primary key default gen_random_uuid(),
 category text not null check(category in ('celular','notebook','consola')), brand text not null, model text not null,
 fault_code text not null check(fault_code in ('pantalla_rota','bateria','no_enciende','carga','otro')),
 repair_min_ars numeric(12,2) not null, repair_max_ars numeric(12,2) not null,
 resale_broken_min_ars numeric(12,2) not null, resale_broken_max_ars numeric(12,2) not null,
 resale_repaired_min_ars numeric(12,2) not null, resale_repaired_max_ars numeric(12,2) not null,
 assumptions text not null, is_active boolean not null default true, updated_at timestamptz not null default now(),
 unique(category,brand,model,fault_code),
 check(repair_min_ars>=0 and repair_max_ars>=repair_min_ars),
 check(resale_broken_min_ars>=0 and resale_broken_max_ars>=resale_broken_min_ars),
 check(resale_repaired_min_ars>=0 and resale_repaired_max_ars>=resale_repaired_min_ars)
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id),
 provider text not null check(provider in ('mercadopago','stripe')),
 provider_subscription_id text,
 status text not null default 'pending' check(status in ('pending','active','past_due','canceled','expired')),
 price_amount numeric(20,6) not null check(price_amount>0), currency text not null check(currency in ('ARS','USD')),
 access_from timestamptz, access_until timestamptz, revoked_at timestamptz, canceled_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(provider,provider_subscription_id),
 check(access_until is null or access_until>access_from)
);
create unique index one_open_subscription on public.subscriptions(user_id) where status in ('pending','active','past_due');
create table public.subscription_payments (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.subscriptions(id),
 provider text not null check(provider in ('mercadopago','stripe')), external_payment_id text not null,
 amount numeric(20,6) not null check(amount>0), currency text not null check(currency in ('ARS','USD')),
 status text not null check(status in ('confirmed','refunded')),
 period_start timestamptz not null, period_end timestamptz not null check(period_end>period_start),
 confirmed_at timestamptz not null, created_at timestamptz not null default now(),
 unique(provider,external_payment_id)
);
create index devices_feed on public.devices(status,created_at desc);
create index devices_owner on public.devices(owner_id);
create index devices_category on public.devices(category,status);
create index subscriptions_user on public.subscriptions(user_id);
create index payments_subscription on public.subscription_payments(subscription_id);

create function private.has_access() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.users u join public.subscriptions s on s.user_id=u.id where u.id=auth.uid() and u.role='tecnico' and s.access_from<=now() and s.access_until>now() and s.revoked_at is null)
$$;
alter table public.users enable row level security;
alter table public.devices enable row level security;
alter table public.device_contacts enable row level security;
alter table public.pricing_catalog enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
revoke all on public.users,public.devices,public.device_contacts,public.pricing_catalog,public.subscriptions,public.subscription_payments from anon,authenticated;
grant select on public.devices,public.pricing_catalog to anon,authenticated;
grant select on public.users,public.subscriptions,public.subscription_payments to authenticated;
grant select(device_id,contact_name,whatsapp_e164,contact_email) on public.device_contacts to authenticated;
grant all on public.users,public.devices,public.device_contacts,public.pricing_catalog,public.subscriptions,public.subscription_payments to service_role;
create policy profile_read on public.users for select to authenticated using(id=auth.uid() or private.is_admin());
create policy device_read on public.devices for select using(status='publicado' or owner_id=auth.uid() or private.is_admin());
create policy catalog_read on public.pricing_catalog for select using(is_active or private.is_admin());
create policy contact_read on public.device_contacts for select to authenticated using(private.is_admin() or exists(select 1 from public.devices d where d.id=device_id and (d.owner_id=auth.uid() or (d.status='publicado' and private.has_access() and permission_confirmed_at is not null))));
create policy subscription_read on public.subscriptions for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy payment_read on public.subscription_payments for select to authenticated using(private.is_admin() or exists(select 1 from public.subscriptions s where s.id=subscription_id and s.user_id=auth.uid()));

-- A single transaction creates the lead and its contact; all writes are checked here.
create function public.save_device(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); device_id uuid; as_admin boolean:=private.is_admin(); requested_status text:=coalesce(p->>'status','borrador'); approved boolean:=coalesce((p->>'permission')::boolean,false); photos text[];
begin
 if actor is null then raise exception 'authentication_required'; end if;
 if requested_status not in ('borrador','publicado') then raise exception 'invalid_status'; end if;
 if requested_status='publicado' and not approved then raise exception 'permission_required'; end if;
 if p->>'city' is distinct from 'Rosario' then raise exception 'rosario_only'; end if;
 select coalesce(array_agg(value),'{}') into photos from jsonb_array_elements_text(coalesce(p->'photo_paths','[]'));
 if exists(select 1 from unnest(photos) x where x not like actor::text||'/%') then raise exception 'invalid_photo_owner'; end if;
 insert into public.devices(owner_id,created_by,category,brand,model,intent,fault_code,description,photo_paths,status,source,neighborhood,published_at)
 values(case when as_admin and p->>'source'='admin' then null else actor end,actor,p->>'category',trim(p->>'brand'),trim(p->>'model'),p->>'intent',p->>'fault_code',p->>'description',photos,requested_status,case when as_admin and p->>'source'='admin' then 'admin' else 'usuario' end,nullif(p->>'neighborhood',''),case when requested_status='publicado' then now() end) returning id into device_id;
 insert into public.device_contacts(device_id,contact_name,whatsapp_e164,contact_email,source_url,permission_confirmed_at,last_verified_at)
 values(device_id,p->>'contact_name',nullif(p->>'whatsapp_e164',''),nullif(p->>'contact_email',''),case when as_admin then nullif(p->>'source_url','') end,case when approved then now() end,case when approved then now() end);
 return device_id;
end;$$;
create function public.set_device_status(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.devices where id=p_id and (owner_id=auth.uid() or private.is_admin())) then raise exception 'forbidden'; end if;
 if p_status not in ('publicado','cerrado','archivado') then raise exception 'invalid_status'; end if;
 if p_status='publicado' and not exists(select 1 from public.device_contacts where device_id=p_id and permission_confirmed_at is not null) then raise exception 'permission_required'; end if;
 update public.devices set status=p_status,updated_at=now(),published_at=case when p_status='publicado' then now() else published_at end,closed_at=case when p_status='cerrado' then now() else null end where id=p_id;
end;$$;
create function public.become_technician() returns void language plpgsql security definer set search_path='' as $$begin update public.users set role='tecnico',updated_at=now() where id=auth.uid() and role='cliente'; end;$$;

-- Service-only, idempotent application of verified provider payments.
create function public.apply_payment(p_subscription uuid,p_external text,p_amount numeric,p_currency text,p_start timestamptz,p_end timestamptz,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare s public.subscriptions; existing public.subscription_payments;
begin
 select * into s from public.subscriptions where id=p_subscription for update;
 if not found then raise exception 'unknown_subscription'; end if;
 if p_amount<>s.price_amount or p_currency<>s.currency or p_end<=p_start or p_status not in ('confirmed','refunded') then raise exception 'payment_mismatch'; end if;
 select * into existing from public.subscription_payments where provider=s.provider and external_payment_id=p_external;
 if found and existing.subscription_id<>s.id then raise exception 'payment_reused'; end if;
 if found and existing.status='refunded' then return; end if;
 insert into public.subscription_payments(subscription_id,provider,external_payment_id,amount,currency,status,period_start,period_end,confirmed_at)
 values(s.id,s.provider,p_external,p_amount,p_currency,p_status,p_start,p_end,now())
 on conflict(provider,external_payment_id) do update set status=excluded.status;
 update public.subscriptions set access_from=(select min(period_start) from public.subscription_payments where subscription_id=s.id and status='confirmed'),access_until=(select max(period_end) from public.subscription_payments where subscription_id=s.id and status='confirmed'),status=case when s.status='canceled' then 'canceled' when p_status='confirmed' then 'active' else 'past_due' end,updated_at=now() where id=s.id;
end;$$;
-- Gaps between paid periods must never grant access.
create or replace function private.has_access() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.users u join public.subscriptions s on s.user_id=u.id join public.subscription_payments p on p.subscription_id=s.id where u.id=auth.uid() and u.role='tecnico' and s.revoked_at is null and p.status='confirmed' and p.period_start<=now() and p.period_end>now())
$$;
revoke all on function private.handle_signup(),private.is_admin(),private.has_access() from public;
grant execute on function private.is_admin(),private.has_access() to anon,authenticated,service_role;
revoke all on function public.save_device(jsonb),public.set_device_status(uuid,text),public.become_technician(),public.apply_payment(uuid,text,numeric,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.save_device(jsonb),public.set_device_status(uuid,text),public.become_technician() to authenticated;
grant execute on function public.apply_payment(uuid,text,numeric,text,timestamptz,timestamptz,text) to service_role;
commit;
