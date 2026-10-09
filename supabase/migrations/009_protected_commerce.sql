begin;
alter table public.users add column verification_status text not null default 'unverified' check(verification_status in ('unverified','pending','verified','rejected','suspended'));
create table public.device_specs (
 device_id uuid primary key references public.devices(id) on delete cascade,
 storage_capacity text not null check(length(storage_capacity) between 1 and 40),
 physical_condition text not null check(length(physical_condition) between 1 and 500),
 power_on text not null check(power_on in ('si','no','desconocido')),
 screen text not null check(length(screen) between 1 and 300),
 battery text not null check(length(battery) between 1 and 300),
 motherboard text not null check(length(motherboard) between 1 and 300),
 activation_lock text not null check(activation_lock in ('libre','bloqueado','desconocido')),
 previous_repairs text not null check(length(previous_repairs) between 1 and 500),
 asking_price numeric(12,2) check(asking_price>0),accepts_offers boolean not null default true,
 delivery text not null check(delivery in ('presencial','envio','ambas')),declared_at timestamptz not null default now()
);
create table public.device_identifiers (
 device_id uuid primary key references public.devices(id) on delete cascade,
 identifier text not null check(length(identifier) between 5 and 32 and identifier ~ '^[A-Za-z0-9-]+$'),
 kind text not null check(kind in ('imei','serial')),check(kind<>'imei' or identifier ~ '^[0-9]{15}$')
);
create table public.device_checks (
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.devices(id),
 source text not null,result text not null check(result in ('clear','flagged','inconclusive')),reference text not null,checked_at timestamptz not null default now()
);
create table private.commerce_config (
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 provider text,fee_bps integer check(fee_bps between 0 and 10000),terms_version text,
 check(not enabled or (provider is not null and fee_bps is not null and terms_version is not null))
);
insert into private.commerce_config(singleton) values(true);
alter table private.commerce_config enable row level security;
revoke all on private.commerce_config from public,anon,authenticated;
create table public.protected_orders (
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.devices(id),
 buyer_id uuid not null references public.users(id),seller_id uuid not null references public.users(id),
 status text not null default 'pending_payment' check(status in ('pending_payment','payment_rejected','protected','preparing','shipped','in_transit','delivered','review','accepted','disputed','resolution_pending','return_requested','return_shipped','return_received','refunded','released','canceled')),
 item_amount numeric(12,2) not null check(item_amount>0),shipping_amount numeric(12,2) not null check(shipping_amount>=0),fee_amount numeric(12,2) not null check(fee_amount>=0),currency text not null default 'ARS' check(currency='ARS'),
 snapshot jsonb not null,provider text not null,provider_payment_id text unique,terms_version text not null,
 review_until timestamptz,tracking text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(buyer_id<>seller_id)
);
create unique index one_device_sale on public.protected_orders(device_id) where status not in ('payment_rejected','canceled','refunded');
create table public.order_events (
 id bigint generated always as identity primary key,order_id uuid not null references public.protected_orders(id),actor_id uuid references public.users(id),event text not null,detail text,created_at timestamptz not null default now()
);
create table public.financial_events (
 provider text not null,external_id text not null,order_id uuid not null references public.protected_orders(id),event text not null,amount numeric(12,2) not null,currency text not null check(currency='ARS'),payment_id text not null,created_at timestamptz not null default now(),primary key(provider,external_id)
);
create table public.disputes (
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.protected_orders(id),opened_by uuid not null references public.users(id),
 reason text not null check(reason in ('empty_package','wrong_product','not_received','identifier_mismatch','activation_lock','omitted_fault','damage','fraud')),
 description text not null check(length(description) between 15 and 2000),status text not null default 'open' check(status in ('open','reviewing','resolved')),resolution text,created_at timestamptz not null default now()
);
create table public.order_messages (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.protected_orders(id),author_id uuid not null references public.users(id),body text not null check(length(body) between 1 and 2000),created_at timestamptz not null default now()
);
create table public.order_evidence (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.protected_orders(id),uploaded_by uuid not null references public.users(id),path text not null unique,
 kind text not null check(kind in ('device','identifier','packing','sealed_package','dispatch','delivery','unboxing','return')),created_at timestamptz not null default now()
);
create table public.financial_requests (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.protected_orders(id),action text not null check(action in ('release','refund')),status text not null default 'pending' check(status in ('pending','submitted','confirmed','failed')),created_at timestamptz not null default now(),unique(order_id,action)
);
create table public.admin_audit (
 id bigint generated always as identity primary key,actor_id uuid not null references public.users(id),target_id uuid not null,action text not null,reason text not null check(length(reason) between 15 and 2000),created_at timestamptz not null default now()
);
create table public.verification_requests (
 user_id uuid primary key references public.users(id),provider_reference text,provider text,requested_at timestamptz not null default now(),verified_at timestamptz
);
create table public.listing_reports (
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.devices(id),reporter_id uuid not null references public.users(id),reason text not null check(length(reason) between 15 and 1000),status text not null default 'open' check(status in ('open','reviewed')),created_at timestamptz not null default now(),unique(device_id,reporter_id)
);
create table public.transaction_reviews (
 order_id uuid not null references public.protected_orders(id),author_id uuid not null references public.users(id),subject_id uuid not null references public.users(id),subject_role text not null check(subject_role in ('buyer','seller')),rating integer not null check(rating between 1 and 5),body text not null check(length(body) between 1 and 1000),challenged boolean not null default false,visible boolean not null default true,created_at timestamptz not null default now(),primary key(order_id,author_id)
);
create function private.account_enabled() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.users where id=auth.uid() and verification_status<>'suspended')$$;
create function private.order_member(p uuid) returns boolean language sql stable security definer set search_path='' as $$select private.is_admin() or exists(select 1 from public.protected_orders where id=p and auth.uid() in (buyer_id,seller_id))$$;
revoke all on function private.account_enabled(),private.order_member(uuid) from public;
grant execute on function private.account_enabled(),private.order_member(uuid) to authenticated,service_role;
alter table public.device_specs enable row level security;
revoke all on public.device_specs from anon,authenticated;
grant select on public.device_specs to authenticated;
grant all on public.device_specs to service_role;
create policy read_device_specs on public.device_specs for select to authenticated using(exists(select 1 from public.devices d where d.id=device_id));
alter table public.device_identifiers enable row level security;
revoke all on public.device_identifiers from anon,authenticated;
grant select on public.device_identifiers to authenticated;
grant all on public.device_identifiers to service_role;
create policy read_device_identifiers on public.device_identifiers for select to authenticated using(private.is_admin() or exists(select 1 from public.devices d where d.id=device_id and d.owner_id=auth.uid()));
alter table public.device_checks enable row level security;
revoke all on public.device_checks from anon,authenticated;
grant select on public.device_checks to authenticated;
grant all on public.device_checks to service_role;
create policy read_device_checks on public.device_checks for select to authenticated using(exists(select 1 from public.devices d where d.id=device_id));
alter table public.protected_orders enable row level security;
revoke all on public.protected_orders from anon,authenticated;
grant select on public.protected_orders to authenticated;
grant all on public.protected_orders to service_role;
create policy read_protected_orders on public.protected_orders for select to authenticated using(auth.uid() in (buyer_id,seller_id) or private.is_admin());
alter table public.order_events enable row level security;
revoke all on public.order_events from anon,authenticated;
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
create policy read_order_events on public.order_events for select to authenticated using(private.order_member(order_id));
alter table public.financial_events enable row level security;
revoke all on public.financial_events from anon,authenticated;
grant select on public.financial_events to authenticated;
grant all on public.financial_events to service_role;
create policy read_financial_events on public.financial_events for select to authenticated using(private.order_member(order_id));
alter table public.disputes enable row level security;
revoke all on public.disputes from anon,authenticated;
grant select on public.disputes to authenticated;
grant all on public.disputes to service_role;
create policy read_disputes on public.disputes for select to authenticated using(private.order_member(order_id));
alter table public.order_messages enable row level security;
revoke all on public.order_messages from anon,authenticated;
grant select on public.order_messages to authenticated;
grant all on public.order_messages to service_role;
create policy read_order_messages on public.order_messages for select to authenticated using(private.order_member(order_id));
alter table public.order_evidence enable row level security;
revoke all on public.order_evidence from anon,authenticated;
grant select on public.order_evidence to authenticated;
grant all on public.order_evidence to service_role;
create policy read_order_evidence on public.order_evidence for select to authenticated using(private.order_member(order_id));
alter table public.financial_requests enable row level security;
revoke all on public.financial_requests from anon,authenticated;
grant select on public.financial_requests to authenticated;
grant all on public.financial_requests to service_role;
create policy read_financial_requests on public.financial_requests for select to authenticated using(private.order_member(order_id));
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon,authenticated;
grant select on public.admin_audit to authenticated;
grant all on public.admin_audit to service_role;
create policy read_admin_audit on public.admin_audit for select to authenticated using(private.is_admin());
alter table public.verification_requests enable row level security;
revoke all on public.verification_requests from anon,authenticated;
grant select on public.verification_requests to authenticated;
grant all on public.verification_requests to service_role;
create policy read_verification_requests on public.verification_requests for select to authenticated using(user_id=auth.uid() or private.is_admin());
alter table public.listing_reports enable row level security;
revoke all on public.listing_reports from anon,authenticated;
grant select on public.listing_reports to authenticated;
grant all on public.listing_reports to service_role;
create policy read_listing_reports on public.listing_reports for select to authenticated using(reporter_id=auth.uid() or private.is_admin());
alter table public.transaction_reviews enable row level security;
revoke all on public.transaction_reviews from anon,authenticated;
grant select on public.transaction_reviews to authenticated;
grant all on public.transaction_reviews to service_role;
create policy read_transaction_reviews on public.transaction_reviews for select to authenticated using(visible or author_id=auth.uid() or subject_id=auth.uid() or private.is_admin());
grant select on public.device_specs,public.device_checks to anon;
create policy anon_specs on public.device_specs for select to anon using(exists(select 1 from public.devices d where d.id=device_id and d.status='publicado'));
create policy anon_checks on public.device_checks for select to anon using(exists(select 1 from public.devices d where d.id=device_id and d.status='publicado'));
alter function public.save_device(jsonb) rename to save_basic_device;
revoke all on function public.save_basic_device(jsonb) from authenticated;
create function public.save_device(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare d uuid; spec jsonb:=p->'specs';
begin
 if not private.account_enabled() then raise exception 'account_suspended'; end if;
 d:=public.save_basic_device(p);
 if spec is not null then
  if jsonb_array_length(p->'photo_paths')<1 then raise exception 'real_photos_required'; end if;
  insert into public.device_specs(device_id,storage_capacity,physical_condition,power_on,screen,battery,motherboard,activation_lock,previous_repairs,asking_price,accepts_offers,delivery)
  values(d,spec->>'storage_capacity',spec->>'physical_condition',spec->>'power_on',spec->>'screen',spec->>'battery',spec->>'motherboard',spec->>'activation_lock',spec->>'previous_repairs',nullif(spec->>'asking_price','')::numeric,coalesce((spec->>'accepts_offers')::boolean,true),spec->>'delivery');
  if coalesce(p->>'identifier','')<>'' then insert into public.device_identifiers values(d,p->>'identifier',p->>'identifier_kind'); end if;
 end if;
 return d;
end;$$;
create function public.create_protected_order(p_device uuid,p_terms text) returns uuid language plpgsql security definer set search_path='' as $$
declare cfg private.commerce_config; d public.devices; spec public.device_specs; result uuid;
begin
 select * into cfg from private.commerce_config;
 if not cfg.enabled then raise exception 'protected_payments_unavailable'; end if;
 if not private.account_enabled() then raise exception 'authentication_required'; end if;
 if p_terms is distinct from cfg.terms_version then raise exception 'terms_required'; end if;
 select * into d from public.devices where id=p_device for update;
 select * into spec from public.device_specs where device_id=p_device;
 if d.status is distinct from 'publicado' or d.owner_id is null or d.owner_id=auth.uid() or d.intent='reparar' or spec.asking_price is null then raise exception 'ineligible_device'; end if;
 if not exists(select 1 from public.users where id=d.owner_id and verification_status='verified') or not exists(select 1 from public.users where id=auth.uid() and verification_status='verified') then raise exception 'verification_required'; end if;
 if spec.delivery<>'presencial' then raise exception 'shipping_quote_unavailable'; end if;
 insert into public.protected_orders(device_id,buyer_id,seller_id,item_amount,shipping_amount,fee_amount,snapshot,provider,terms_version)
 values(d.id,auth.uid(),d.owner_id,spec.asking_price,0,round(spec.asking_price*cfg.fee_bps/10000,2),jsonb_build_object('device',to_jsonb(d),'specs',to_jsonb(spec)),cfg.provider,cfg.terms_version) returning id into result;
 insert into public.order_events(order_id,actor_id,event) values(result,auth.uid(),'pending_payment');
 return result;
end;$$;
create function public.order_action(p_order uuid,p_action text,p_detail text default '') returns void language plpgsql security definer set search_path='' as $$
declare o public.protected_orders; next_state text;
begin
 select * into o from public.protected_orders where id=p_order for update;
 if not found or auth.uid() not in (o.buyer_id,o.seller_id) or not private.account_enabled() then raise exception 'forbidden'; end if;
 if length(p_detail)>2000 then raise exception 'detail_too_long'; end if;
 if p_action='cancel' and o.status in ('pending_payment','payment_rejected') then next_state:='canceled';
 elsif p_action='prepare' and auth.uid()=o.seller_id and o.status='protected' then next_state:='preparing';
 elsif p_action='dispatch' and auth.uid()=o.seller_id and o.status='preparing' and length(p_detail) between 4 and 200 and exists(select 1 from public.order_evidence where order_id=o.id and kind='dispatch') then next_state:='shipped';
 elsif p_action='accept' and auth.uid()=o.buyer_id and o.status in ('delivered','review') and not exists(select 1 from public.disputes where order_id=o.id and status<>'resolved') then
  next_state:='accepted';
  insert into public.financial_requests(order_id,action) values(o.id,'release') on conflict do nothing;
 elsif p_action='return_dispatch' and auth.uid()=o.buyer_id and o.status='return_requested' and length(p_detail) between 4 and 200 then next_state:='return_shipped';
 else raise exception 'invalid_transition'; end if;
 update public.protected_orders set status=next_state,tracking=case when p_action in ('dispatch','return_dispatch') then p_detail else tracking end,updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,event,detail) values(o.id,auth.uid(),next_state,p_detail);
end;$$;
create function public.open_dispute(p_order uuid,p_reason text,p_description text) returns void language plpgsql security definer set search_path='' as $$
declare o public.protected_orders;
begin
 select * into o from public.protected_orders where id=p_order for update;
 if not found or auth.uid()<>o.buyer_id or not private.account_enabled() then raise exception 'forbidden'; end if;
 if o.status in ('pending_payment','payment_rejected','canceled','refunded') then raise exception 'no_paid_purchase'; end if;
 -- Claims remain possible after the suggested inspection window.
 insert into public.disputes(order_id,opened_by,reason,description) values(o.id,auth.uid(),p_reason,p_description);
 update public.protected_orders set status='disputed',updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,event) values(o.id,auth.uid(),'disputed');
end;$$;
create function public.order_message(p_order uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.order_member(p_order) or not private.account_enabled() then raise exception 'forbidden'; end if;
 if (select count(*) from public.order_messages where author_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'rate_limit'; end if;
 insert into public.order_messages(order_id,author_id,body) values(p_order,auth.uid(),p_body);
end;$$;
create function public.admin_commerce_action(p_target uuid,p_action text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare o public.protected_orders;
begin
 if not private.is_admin() then raise exception 'forbidden'; end if;
 insert into public.admin_audit(actor_id,target_id,action,reason) values(auth.uid(),p_target,p_action,p_reason);
 if p_action='suspend' then
  if p_target=auth.uid() then raise exception 'cannot_suspend_self'; end if;
  update public.users set verification_status='suspended' where id=p_target and role<>'admin';
 elsif p_action='reject_verification' then update public.users set verification_status='rejected' where id=p_target and verification_status='pending';
 elsif p_action='review_report' then update public.listing_reports set status='reviewed' where id=p_target;
 elsif p_action='hide_review' then update public.transaction_reviews set visible=false where order_id=p_target and challenged;
 else
  select * into o from public.protected_orders where id=p_target for update;
  if not found then raise exception 'unknown_order'; end if;
  if p_action='review_dispute' and o.status='disputed' then
   update public.disputes set status='reviewing' where order_id=o.id;
   update public.protected_orders set status='resolution_pending' where id=o.id;
  elsif p_action='request_return' and o.status='resolution_pending' then update public.protected_orders set status='return_requested' where id=o.id;
  elsif p_action in ('request_refund','resolve_release') and o.status in ('resolution_pending','return_received') then
   update public.disputes set status='resolved',resolution=p_reason where order_id=o.id;
   insert into public.financial_requests(order_id,action) values(o.id,case when p_action='request_refund' then 'refund' else 'release' end) on conflict do nothing;
   if p_action='resolve_release' then update public.protected_orders set status='accepted' where id=o.id; end if;
  else raise exception 'invalid_admin_transition'; end if;
  insert into public.order_events(order_id,actor_id,event,detail) values(o.id,auth.uid(),p_action,p_reason);
 end if;
end;$$;
-- No HTTP handler invokes this until a custody contract and verified adapter exist.
create function public.apply_commerce_event(p_order uuid,p_external text,p_event text,p_amount numeric,p_currency text,p_payment text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.protected_orders; e public.financial_events; target text; cfg private.commerce_config;
begin
 select * into cfg from private.commerce_config;
 if not cfg.enabled then raise exception 'protected_payments_unavailable'; end if;
 select * into o from public.protected_orders where id=p_order for update;
 if not found or o.provider<>cfg.provider then raise exception 'provider_mismatch'; end if;
 if p_external is null or length(p_external) not between 1 and 200 or p_payment is null or length(p_payment) not between 1 and 200 then raise exception 'invalid_reference'; end if;
 select * into e from public.financial_events where provider=o.provider and external_id=p_external;
 if found then
  if e.order_id<>o.id or e.event<>p_event or e.amount<>p_amount or e.currency<>p_currency or e.payment_id<>p_payment then raise exception 'event_reused'; end if;
  return;
 end if;
 if p_amount is distinct from o.item_amount+o.shipping_amount+o.fee_amount or p_currency is distinct from 'ARS' or (o.provider_payment_id is not null and o.provider_payment_id<>p_payment) then raise exception 'payment_mismatch'; end if;
 if p_event='protected' and o.status='pending_payment' then target:='protected';
 elsif p_event='rejected' and o.status='pending_payment' then target:='payment_rejected';
 elsif p_event='in_transit' and o.status='shipped' then target:='in_transit';
 elsif p_event='delivered' and o.status in ('shipped','in_transit') then target:='review';
 elsif p_event='return_received' and o.status='return_shipped' then target:='return_received';
 elsif p_event='released' and o.status='accepted' and exists(select 1 from public.financial_requests where order_id=o.id and action='release') then target:='released';
 elsif p_event='refunded' and o.status in ('resolution_pending','return_received') and exists(select 1 from public.financial_requests where order_id=o.id and action='refund') then target:='refunded';
 else raise exception 'invalid_provider_transition'; end if;
 if p_event in ('released','refunded') and exists(select 1 from public.disputes where order_id=o.id and status<>'resolved') then raise exception 'active_dispute'; end if;
 insert into public.financial_events values(o.provider,p_external,o.id,p_event,p_amount,p_currency,p_payment,now());
 update public.protected_orders set status=target,provider_payment_id=p_payment,review_until=case when p_event='delivered' then now()+interval '48 hours' else review_until end,updated_at=now() where id=o.id;
 if p_event in ('released','refunded') then update public.financial_requests set status='confirmed' where order_id=o.id and action=case when p_event='released' then 'release' else 'refund' end; end if;
 insert into public.order_events(order_id,event) values(o.id,p_event);
end;$$;
create function public.submit_review(p_order uuid,p_rating integer,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare o public.protected_orders;
begin
 select * into o from public.protected_orders where id=p_order;
 if not found or o.status<>'released' or auth.uid() not in (o.buyer_id,o.seller_id) or not private.account_enabled() then raise exception 'completed_purchase_required'; end if;
 insert into public.transaction_reviews(order_id,author_id,subject_id,subject_role,rating,body)
 values(o.id,auth.uid(),case when auth.uid()=o.buyer_id then o.seller_id else o.buyer_id end,case when auth.uid()=o.buyer_id then 'seller' else 'buyer' end,p_rating,p_body);
end;$$;
create function public.challenge_review(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
begin update public.transaction_reviews set challenged=true where order_id=p_order and subject_id=auth.uid(); end;$$;
create function public.report_listing(p_device uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.account_enabled() then raise exception 'forbidden'; end if;
 if (select count(*) from public.listing_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'rate_limit'; end if;
 insert into public.listing_reports(device_id,reporter_id,reason) values(p_device,auth.uid(),p_reason);
end;$$;
create function public.request_verification() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.account_enabled() then raise exception 'forbidden'; end if;
 insert into public.verification_requests(user_id) values(auth.uid()) on conflict do nothing;
 update public.users set verification_status='pending' where id=auth.uid() and verification_status in ('unverified','rejected');
end;$$;
create function public.public_reputation(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',u.display_name,'joined',u.created_at,'verification',u.verification_status,
 'sales',(select count(*) from public.protected_orders where seller_id=u.id and status='released'),
 'purchases',(select count(*) from public.protected_orders where buyer_id=u.id and status='released'),
 'seller_rating',(select avg(rating) from public.transaction_reviews where subject_id=u.id and subject_role='seller' and visible and not challenged),
 'buyer_rating',(select avg(rating) from public.transaction_reviews where subject_id=u.id and subject_role='buyer' and visible and not challenged))
 from public.users u where u.id=p_user
$$;
revoke all on function public.save_device(jsonb) from public,anon,authenticated;
grant execute on function public.save_device(jsonb) to authenticated;
revoke all on function public.create_protected_order(uuid,text) from public,anon,authenticated;
grant execute on function public.create_protected_order(uuid,text) to authenticated;
revoke all on function public.order_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.order_action(uuid,text,text) to authenticated;
revoke all on function public.open_dispute(uuid,text,text) from public,anon,authenticated;
grant execute on function public.open_dispute(uuid,text,text) to authenticated;
revoke all on function public.order_message(uuid,text) from public,anon,authenticated;
grant execute on function public.order_message(uuid,text) to authenticated;
revoke all on function public.admin_commerce_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_commerce_action(uuid,text,text) to authenticated;
revoke all on function public.submit_review(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.submit_review(uuid,integer,text) to authenticated;
revoke all on function public.challenge_review(uuid) from public,anon,authenticated;
grant execute on function public.challenge_review(uuid) to authenticated;
revoke all on function public.report_listing(uuid,text) from public,anon,authenticated;
grant execute on function public.report_listing(uuid,text) to authenticated;
revoke all on function public.request_verification() from public,anon,authenticated;
grant execute on function public.request_verification() to authenticated;
revoke all on function public.apply_commerce_event(uuid,text,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.apply_commerce_event(uuid,text,text,numeric,text,text) to service_role;
revoke all on function public.public_reputation(uuid) from public;
grant execute on function public.public_reputation(uuid) to anon,authenticated;

-- Public specification text must not bypass the contact/identifier boundary.
alter table public.device_specs add constraint specs_no_contacts check(
 concat_ws(' ',storage_capacity,physical_condition,screen,battery,motherboard,previous_repairs)
 !~* '(https?://|www[.]|wa[.]me|[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}|([+]?[0-9][ ()-]*){8,})');
create table public.order_identifiers (
 order_id uuid primary key references public.protected_orders(id),
 identifier text not null, kind text not null check(kind in ('imei','serial'))
);
alter table public.order_identifiers enable row level security;
revoke all on public.order_identifiers from anon,authenticated;
grant select on public.order_identifiers to authenticated;
grant all on public.order_identifiers to service_role;
create policy order_identifier_read on public.order_identifiers for select to authenticated using(private.order_member(order_id));
create function private.snapshot_identifier() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.order_identifiers(order_id,identifier,kind) select new.id,identifier,kind from public.device_identifiers where device_id=new.device_id;
 return new;
end;$$;
create trigger snapshot_order_identifier after insert on public.protected_orders for each row execute function private.snapshot_identifier();
revoke all on function private.snapshot_identifier() from public;
create function private.limit_evidence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.protected_orders where id=new.order_id and new.uploaded_by in (buyer_id,seller_id) for update;
 if not found then raise exception 'invalid_evidence_owner'; end if;
 if not exists(select 1 from public.users where id=new.uploaded_by and verification_status<>'suspended') then raise exception 'account_suspended'; end if;
 if new.path not like new.order_id::text||'/'||new.uploaded_by::text||'/%' then raise exception 'invalid_evidence_path'; end if;
 if (select count(*) from public.order_evidence where order_id=new.order_id)>=30 then raise exception 'evidence_limit'; end if;
 return new;
end;$$;
create trigger evidence_limit before insert on public.order_evidence for each row execute function private.limit_evidence();
revoke all on function private.limit_evidence() from public;
create or replace function private.has_access() returns boolean language sql stable security definer set search_path='' as $$
 select private.account_enabled() and exists(select 1 from public.users u join public.subscriptions s on s.user_id=u.id join public.subscription_payments p on p.subscription_id=s.id where u.id=auth.uid() and u.role='tecnico' and s.revoked_at is null and p.status='confirmed' and p.period_start<=now() and p.period_end>now())
$$;
create function private.block_suspended_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not private.account_enabled() then raise exception 'account_suspended'; end if;
 return new;
end;$$;
create trigger suspension_guard before insert or update on public.devices for each row execute function private.block_suspended_publication();
revoke all on function private.block_suspended_publication() from public;

commit;
