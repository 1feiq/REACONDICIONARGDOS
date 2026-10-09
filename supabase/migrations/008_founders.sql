begin;
-- Existing contracts retain their agreed price and legacy reconciler.
alter table public.subscriptions add column billing_version integer not null default 1 check(billing_version in (1,2)),
 add column started_at timestamptz, add column billed_cycles integer not null default 0 check(billed_cycles>=0),
 add column standard_price numeric not null default 10000 check(standard_price=10000),
 add column founder_price numeric not null default 7500 check(founder_price=7500),
 add column promotion_lost_at timestamptz, add column terms_version text,
 add column renewal_at timestamptz;
alter table public.subscription_payments add column cycle_number integer;
create unique index subscription_cycle on public.subscription_payments(subscription_id,cycle_number) where cycle_number is not null;
create table public.founder_slots (
 slot integer primary key check(slot between 1 and 100),
 user_id uuid unique references public.users(id), subscription_id uuid unique references public.subscriptions(id),
 assigned_at timestamptz, lost_at timestamptz,
 check((user_id is null and subscription_id is null and assigned_at is null) or (user_id is not null and subscription_id is not null and assigned_at is not null))
);
insert into public.founder_slots(slot) select generate_series(1,100);
alter table public.founder_slots enable row level security;
revoke all on public.founder_slots from anon,authenticated;
grant select on public.founder_slots to authenticated;
grant all on public.founder_slots to service_role;
create policy founder_read on public.founder_slots for select to authenticated using(user_id=auth.uid() or private.is_admin());
create function public.founder_availability() returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.founder_slots where user_id is null
$$;
revoke all on function public.founder_availability() from public;
grant execute on function public.founder_availability() to anon,authenticated,service_role;

create function private.forfeit_founder() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='canceled' and old.status is distinct from 'canceled' then
  new.promotion_lost_at:=coalesce(old.promotion_lost_at,now());
  update public.founder_slots set lost_at=coalesce(lost_at,now()) where user_id=new.user_id;
 end if;
 return new;
end;$$;
create trigger forfeit_founder before update on public.subscriptions for each row execute function private.forfeit_founder();
revoke all on function private.forfeit_founder() from public;

-- Invoked ONLY after the provider confirms the amount, invoice, currency and dates.
-- A rejected/unauthorized payment never calls this function.
create function public.apply_pro_payment(p_subscription uuid,p_external text,p_amount numeric,p_start timestamptz,p_end timestamptz,p_cycle integer,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.subscriptions; old_payment public.subscription_payments; f public.founder_slots;
 expected numeric; available integer; previous_end timestamptz;
begin
 -- Global lock serializes the first-payment decision, including the last slot.
 perform pg_advisory_xact_lock(7525100);
 select * into s from public.subscriptions where id=p_subscription for update;
 if not found or s.billing_version<>2 then raise exception 'unknown_pro_contract'; end if;
 if p_external is null or length(p_external) not between 1 and 200 or p_status not in ('confirmed','refunded') or p_cycle<1 or p_start is null or p_end is null or p_end<=p_start then raise exception 'invalid_payment'; end if;
 select * into old_payment from public.subscription_payments where provider=s.provider and external_payment_id=p_external;
 if found then
  if old_payment.subscription_id<>s.id or old_payment.amount<>p_amount or old_payment.cycle_number<>p_cycle or old_payment.period_start<>p_start or old_payment.period_end<>p_end then raise exception 'payment_reused'; end if;
  if old_payment.status='refunded' or old_payment.status=p_status then return; end if;
  update public.subscription_payments set status='refunded' where id=old_payment.id;
  update public.subscriptions set revoked_at=now(),promotion_lost_at=coalesce(promotion_lost_at,now()) where id=s.id;
  update public.founder_slots set lost_at=coalesce(lost_at,now()) where user_id=s.user_id;
  return;
 end if;
 if p_status<>'confirmed' then raise exception 'refund_requires_original'; end if;
 if p_cycle<>s.billed_cycles+1 then raise exception 'reconcile_cycles_in_order'; end if;
 if s.canceled_at is not null and p_start>=s.canceled_at then raise exception 'charge_after_cancellation'; end if;
 if s.revoked_at is not null then raise exception 'revoked_contract'; end if;
 select max(period_end) into previous_end from public.subscription_payments where subscription_id=s.id;
 if previous_end is not null and p_start<>previous_end then
  if p_start<previous_end then raise exception 'overlapping_cycle'; end if;
  update public.subscriptions set promotion_lost_at=coalesce(promotion_lost_at,now()) where id=s.id;
  s.promotion_lost_at:=now();
  update public.founder_slots set lost_at=coalesce(lost_at,now()) where user_id=s.user_id;
 end if;
 select * into f from public.founder_slots where user_id=s.user_id;
 if p_cycle=1 and f.user_id is null and s.canceled_at is null and
  exists(select 1 from public.users where id=s.user_id and role='tecnico') and
  not exists(select 1 from public.subscriptions x join public.subscription_payments y on y.subscription_id=x.id where x.user_id=s.user_id) then
  select slot into available from public.founder_slots where user_id is null order by slot limit 1 for update;
  if available is not null then
   update public.founder_slots set user_id=s.user_id,subscription_id=s.id,assigned_at=now() where slot=available returning * into f;
  end if;
 end if;
 expected:=case when f.subscription_id=s.id and f.lost_at is null and s.promotion_lost_at is null and p_cycle<=6 then 7500 else 10000 end;
 if p_amount is distinct from expected or s.currency<>'ARS' then raise exception 'contract_amount_mismatch'; end if;
 insert into public.subscription_payments(subscription_id,provider,external_payment_id,amount,currency,status,period_start,period_end,confirmed_at,cycle_number)
 values(s.id,s.provider,p_external,p_amount,'ARS','confirmed',p_start,p_end,now(),p_cycle);
 update public.subscriptions set billed_cycles=p_cycle,started_at=coalesce(started_at,p_start),access_from=coalesce(access_from,p_start),access_until=p_end,
 renewal_at=case when canceled_at is null then p_end end,
 price_amount=case when f.subscription_id=s.id and f.lost_at is null and promotion_lost_at is null and p_cycle<6 then 7500 else 10000 end,
 status=case when canceled_at is null then 'active' else 'canceled' end,updated_at=now() where id=s.id;
end;$$;
revoke all on function public.apply_pro_payment(uuid,text,numeric,timestamptz,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.apply_pro_payment(uuid,text,numeric,timestamptz,timestamptz,integer,text) to service_role;
-- Prevent the old webhook reconciler from bypassing the new contract rules.
alter function public.apply_payment(uuid,text,numeric,text,timestamptz,timestamptz,text) rename to apply_legacy_payment;
revoke all on function public.apply_legacy_payment(uuid,text,numeric,text,timestamptz,timestamptz,text) from service_role;
create function public.apply_payment(p_subscription uuid,p_external text,p_amount numeric,p_currency text,p_start timestamptz,p_end timestamptz,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.subscriptions where id=p_subscription and billing_version=1) then raise exception 'legacy_contract_required'; end if;
 perform public.apply_legacy_payment(p_subscription,p_external,p_amount,p_currency,p_start,p_end,p_status);
end;$$;
revoke all on function public.apply_payment(uuid,text,numeric,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.apply_payment(uuid,text,numeric,text,timestamptz,timestamptz,text) to service_role;
commit;
