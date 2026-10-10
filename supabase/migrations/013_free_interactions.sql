begin;
create table public.conversations(
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.devices(id),
 buyer_id uuid not null references public.users(id),seller_id uuid not null references public.users(id),
 created_at timestamptz not null default now(),unique(device_id,buyer_id),check(buyer_id<>seller_id)
);
create table public.messages(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id),
 sender_id uuid not null references public.users(id),body text not null check(length(trim(body)) between 1 and 2000),
 request_id uuid not null,created_at timestamptz not null default now(),unique(sender_id,request_id)
);
create table public.offers(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id),
 author_id uuid not null references public.users(id),amount numeric(12,2) not null check(amount between 1 and 999999999),
 status text not null default 'pending' check(status in ('pending','accepted','rejected','withdrawn')),
 created_at timestamptz not null default now()
);
create unique index one_pending_offer on public.offers(conversation_id) where status='pending';
create table public.direct_deals(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id),
 device_id uuid not null references public.devices(id),offer_id uuid not null unique references public.offers(id),
 buyer_id uuid not null references public.users(id),seller_id uuid not null references public.users(id),
 status text not null default 'agreed' check(status in ('agreed','completed','canceled')),
 buyer_confirmed_at timestamptz,seller_confirmed_at timestamptz,created_at timestamptz not null default now()
);
create unique index one_active_direct_sale on public.direct_deals(device_id) where status<>'canceled';
create table public.direct_reviews(
 deal_id uuid not null references public.direct_deals(id),author_id uuid not null references public.users(id),
 subject_id uuid not null references public.users(id),subject_role text not null check(subject_role in ('buyer','seller')),
 rating integer not null check(rating between 1 and 5),body text not null check(length(body) between 1 and 1000),
 challenged boolean not null default false,visible boolean not null default true,created_at timestamptz not null default now(),primary key(deal_id,author_id)
);
create table public.favorites(user_id uuid not null references public.users(id),device_id uuid not null references public.devices(id),created_at timestamptz not null default now(),primary key(user_id,device_id));
create table public.user_blocks(user_id uuid not null references public.users(id),blocked_id uuid not null references public.users(id),created_at timestamptz not null default now(),primary key(user_id,blocked_id),check(user_id<>blocked_id));
create table public.user_reports(
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.users(id),subject_id uuid not null references public.users(id),
 reason text not null check(length(reason) between 15 and 1000),status text not null default 'open' check(status in ('open','reviewed')),created_at timestamptz not null default now(),unique(reporter_id,subject_id)
);
create table public.notifications(
 id bigint generated always as identity primary key,user_id uuid not null references public.users(id),kind text not null,
 target_id uuid not null,read_at timestamptz,created_at timestamptz not null default now()
);
create table public.saved_searches(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id),
 name text not null check(length(name) between 1 and 100),filters jsonb not null check(jsonb_typeof(filters)='object' and octet_length(filters::text)<=1500),
 seen_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create index messages_conversation on public.messages(conversation_id,created_at desc);
create index conversations_buyer on public.conversations(buyer_id,created_at desc);
create index conversations_seller on public.conversations(seller_id,created_at desc);
create index notifications_user on public.notifications(user_id,created_at desc);
create function private.conversation_member(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversations where id=p_id and auth.uid() in (buyer_id,seller_id))
$$;
create function private.users_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_blocks where (user_id=a and blocked_id=b) or (user_id=b and blocked_id=a))
$$;
revoke all on function private.conversation_member(uuid),private.users_blocked(uuid,uuid) from public;
grant execute on function private.conversation_member(uuid),private.users_blocked(uuid,uuid) to authenticated,service_role;
alter table public.conversations enable row level security;
revoke all on public.conversations from anon,authenticated;
grant select on public.conversations to authenticated;
grant all on public.conversations to service_role;
create policy read_conversations on public.conversations for select to authenticated using(auth.uid() in (buyer_id,seller_id));
alter table public.messages enable row level security;
revoke all on public.messages from anon,authenticated;
grant select on public.messages to authenticated;
grant all on public.messages to service_role;
create policy read_messages on public.messages for select to authenticated using(private.conversation_member(conversation_id));
alter table public.offers enable row level security;
revoke all on public.offers from anon,authenticated;
grant select on public.offers to authenticated;
grant all on public.offers to service_role;
create policy read_offers on public.offers for select to authenticated using(private.conversation_member(conversation_id));
alter table public.direct_deals enable row level security;
revoke all on public.direct_deals from anon,authenticated;
grant select on public.direct_deals to authenticated;
grant all on public.direct_deals to service_role;
create policy read_direct_deals on public.direct_deals for select to authenticated using(auth.uid() in (buyer_id,seller_id));
alter table public.direct_reviews enable row level security;
revoke all on public.direct_reviews from anon,authenticated;
grant select on public.direct_reviews to authenticated;
grant all on public.direct_reviews to service_role;
create policy read_direct_reviews on public.direct_reviews for select to authenticated using(visible or author_id=auth.uid() or subject_id=auth.uid() or private.is_admin());
alter table public.favorites enable row level security;
revoke all on public.favorites from anon,authenticated;
grant select on public.favorites to authenticated;
grant all on public.favorites to service_role;
create policy read_favorites on public.favorites for select to authenticated using(user_id=auth.uid());
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon,authenticated;
grant select on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
create policy read_user_blocks on public.user_blocks for select to authenticated using(user_id=auth.uid());
alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon,authenticated;
grant select on public.user_reports to authenticated;
grant all on public.user_reports to service_role;
create policy read_user_reports on public.user_reports for select to authenticated using(reporter_id=auth.uid() or private.is_admin());
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy read_notifications on public.notifications for select to authenticated using(user_id=auth.uid());
alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from anon,authenticated;
grant select on public.saved_searches to authenticated;
grant all on public.saved_searches to service_role;
create policy read_saved_searches on public.saved_searches for select to authenticated using(user_id=auth.uid());

create or replace function public.reveal_contact(p_device uuid) returns table(contact_name text,whatsapp_e164 text,contact_email text) language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 if not private.account_enabled() then raise exception 'authentication_required'; end if;
 select owner_id into owner from public.devices where id=p_device;
 if private.is_admin() or owner=auth.uid() then return query select c.contact_name,c.whatsapp_e164,c.contact_email from public.device_contacts c where c.device_id=p_device;return;end if;
 if owner is not null and private.users_blocked(auth.uid(),owner) then raise exception 'contact_unavailable'; end if;
 if not exists(select 1 from public.devices d join public.device_contacts c on c.device_id=d.id where d.id=p_device and d.status='publicado' and d.moderation_status='approved' and c.permission_confirmed_at is not null and c.contact_scope='registered_free') then raise exception 'contact_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if not exists(select 1 from private.contact_reveals where user_id=auth.uid() and device_id=p_device and revealed_at>now()-interval '24 hours') then
  if (select count(*) from private.contact_reveals where user_id=auth.uid() and revealed_at>now()-interval '24 hours')>=30 then raise exception 'contact_daily_limit'; end if;
  insert into private.contact_reveals values(auth.uid(),p_device,now()) on conflict(user_id,device_id) do update set revealed_at=excluded.revealed_at;
 end if;
 return query select c.contact_name,c.whatsapp_e164,c.contact_email from public.device_contacts c where c.device_id=p_device;
end;$$;
create function public.start_conversation(p_device uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.devices; result uuid;
begin
 if not private.account_enabled() then raise exception 'authentication_required'; end if;
 select * into d from public.devices where id=p_device;
 if d.status is distinct from 'publicado' or d.moderation_status is distinct from 'approved' or d.owner_id is null or d.owner_id=auth.uid() or private.users_blocked(auth.uid(),d.owner_id) then raise exception 'conversation_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,221));
 select id into result from public.conversations where device_id=d.id and buyer_id=auth.uid();
 if result is not null then return result; end if;
 if (select count(*) from public.conversations where buyer_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'conversation_limit'; end if;
 insert into public.conversations(device_id,buyer_id,seller_id) values(d.id,auth.uid(),d.owner_id) returning id into result;
 return result;
end;$$;
create function public.send_message(p_conversation uuid,p_body text,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.conversations; old public.messages;
begin
 select * into c from public.conversations where id=p_conversation;
 if not found or not private.account_enabled() or not private.conversation_member(c.id) or private.users_blocked(c.buyer_id,c.seller_id) then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,222));
 select * into old from public.messages where sender_id=auth.uid() and request_id=p_request;
 if found then
  if old.conversation_id<>c.id or old.body<>trim(p_body) then raise exception 'request_reused'; end if;
  return;
 end if;
 if (select count(*) from public.messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=10 or (select count(*) from public.messages where sender_id=auth.uid() and created_at>now()-interval '1 day')>=200 then raise exception 'message_limit'; end if;
 insert into public.messages(conversation_id,sender_id,body,request_id) values(c.id,auth.uid(),trim(p_body),p_request);
 insert into public.notifications(user_id,kind,target_id) values(case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end,'message',c.id);
end;$$;
create function public.make_offer(p_conversation uuid,p_amount numeric) returns void language plpgsql security definer set search_path='' as $$
declare c public.conversations;
begin
 select * into c from public.conversations where id=p_conversation for update;
 if not found or not private.account_enabled() or not private.conversation_member(c.id) or private.users_blocked(c.buyer_id,c.seller_id) then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.devices d join public.device_specs s on s.device_id=d.id where d.id=c.device_id and d.status='publicado' and d.moderation_status='approved' and s.accepts_offers) then raise exception 'offers_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,223));
 if (select count(*) from public.offers where author_id=auth.uid() and created_at>now()-interval '1 day')>=30 then raise exception 'offer_limit'; end if;
 insert into public.offers(conversation_id,author_id,amount) values(c.id,auth.uid(),p_amount);
 insert into public.notifications(user_id,kind,target_id) values(case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end,'offer',c.id);
end;$$;
create function public.answer_offer(p_offer uuid,p_answer text) returns void language plpgsql security definer set search_path='' as $$
declare o public.offers; c public.conversations;
begin
 select * into o from public.offers where id=p_offer for update;
 select * into c from public.conversations where id=o.conversation_id;
 if c.id is null or not private.account_enabled() or not private.conversation_member(c.id) or private.users_blocked(c.buyer_id,c.seller_id) or o.status<>'pending' then raise exception 'forbidden'; end if;
 if p_answer='withdrawn' and o.author_id=auth.uid() then null;
 elsif p_answer in ('accepted','rejected') and o.author_id<>auth.uid() then null;
 else raise exception 'invalid_answer'; end if;
 if p_answer='accepted' then
  perform 1 from public.devices where id=c.device_id and status='publicado' and moderation_status='approved' for update;
  if not found then raise exception 'listing_unavailable'; end if;
  insert into public.direct_deals(conversation_id,device_id,offer_id,buyer_id,seller_id) values(c.id,c.device_id,o.id,c.buyer_id,c.seller_id);
 end if;
 update public.offers set status=p_answer where id=o.id;
 insert into public.notifications(user_id,kind,target_id) values(case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end,'offer_answer',c.id);
end;$$;
create function public.market_action(p_action text,p_id uuid,p_data jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare d public.direct_deals; recipient uuid;
begin
 if not private.account_enabled() then raise exception 'authentication_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,224));
 if p_action='favorite' then
  if (select count(*) from public.favorites where user_id=auth.uid())>=500 then raise exception 'favorite_limit';end if;
  if not exists(select 1 from public.devices where id=p_id and status='publicado' and moderation_status='approved') then raise exception 'listing_unavailable';end if;
  insert into public.favorites(user_id,device_id) values(auth.uid(),p_id) on conflict do nothing;
 elsif p_action='unfavorite' then delete from public.favorites where user_id=auth.uid() and device_id=p_id;
 elsif p_action='block' then insert into public.user_blocks(user_id,blocked_id) values(auth.uid(),p_id) on conflict do nothing;
 elsif p_action='unblock' then delete from public.user_blocks where user_id=auth.uid() and blocked_id=p_id;
 elsif p_action='report_user' then
  if (select count(*) from public.user_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'report_limit';end if;
  insert into public.user_reports(reporter_id,subject_id,reason) values(auth.uid(),p_id,p_data->>'reason');
 elsif p_action='save_search' then
  if (select count(*) from public.saved_searches where user_id=auth.uid())>=20 then raise exception 'search_limit'; end if;
  insert into public.saved_searches(user_id,name,filters) values(auth.uid(),p_data->>'name',p_data->'filters');
 elsif p_action='delete_search' then delete from public.saved_searches where user_id=auth.uid() and id=p_id;
 elsif p_action='read_search' then update public.saved_searches set seen_at=now() where user_id=auth.uid() and id=p_id;
 elsif p_action='read_notifications' then update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null;
 elsif p_action='profile' then
  if length(trim(p_data->>'display_name')) not between 2 and 100 or length(trim(p_data->>'city')) not between 2 and 80 or length(trim(p_data->>'province')) not between 2 and 80 then raise exception 'invalid_profile';end if;
  update public.users set display_name=trim(p_data->>'display_name'),city=trim(p_data->>'city'),province=trim(p_data->>'province'),updated_at=now() where id=auth.uid();
 elsif p_action in ('confirm_deal','cancel_deal','review_deal') then
  select * into d from public.direct_deals where id=p_id for update;
  if not found or auth.uid() not in (d.buyer_id,d.seller_id) then raise exception 'forbidden'; end if;
  recipient:=case when auth.uid()=d.buyer_id then d.seller_id else d.buyer_id end;
  if p_action='confirm_deal' and d.status='agreed' then
   update public.direct_deals set buyer_confirmed_at=case when auth.uid()=buyer_id then coalesce(buyer_confirmed_at,now()) else buyer_confirmed_at end,seller_confirmed_at=case when auth.uid()=seller_id then coalesce(seller_confirmed_at,now()) else seller_confirmed_at end where id=d.id returning * into d;
   if d.buyer_confirmed_at is not null and d.seller_confirmed_at is not null then
    update public.direct_deals set status='completed' where id=d.id;
    update public.devices set status='cerrado',closed_at=now(),ad_eligible=false where id=d.device_id;
   end if;
  elsif p_action='cancel_deal' and d.status='agreed' then update public.direct_deals set status='canceled' where id=d.id;
  elsif p_action='review_deal' and d.status='completed' then
   insert into public.direct_reviews(deal_id,author_id,subject_id,subject_role,rating,body) values(d.id,auth.uid(),recipient,case when recipient=d.seller_id then 'seller' else 'buyer' end,(p_data->>'rating')::integer,p_data->>'body');
  else raise exception 'invalid_deal_state';end if;
  insert into public.notifications(user_id,kind,target_id) values(recipient,'deal',d.conversation_id);
 elsif p_action='challenge_review' then update public.direct_reviews set challenged=true where deal_id=p_id and subject_id=auth.uid();
 else raise exception 'unknown_action';end if;
end;$$;
create function public.moderate_marketplace(p_id uuid,p_action text,p_reason text,p_enabled boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'forbidden'; end if;
 insert into public.admin_audit(actor_id,target_id,action,reason) values(auth.uid(),p_id,p_action,p_reason);
 if p_action in ('approve','reject','approve_ads') then
  if p_action='approve' then
   if not exists(select 1 from public.device_contacts where device_id=p_id and permission_confirmed_at is not null) then raise exception 'permission_required';end if;
   update public.devices set moderation_status='approved' where id=p_id;
  elsif p_action='reject' then update public.devices set moderation_status='rejected',ad_eligible=false where id=p_id;
  else
   if exists(select 1 from public.listing_reports where device_id=p_id and status='open') then raise exception 'open_reports';end if;
   update public.devices set ad_eligible=p_enabled where id=p_id and moderation_status='approved';
  end if;
 elsif p_action='review_report' then update public.listing_reports set status='reviewed' where id=p_id;
 elsif p_action='review_user_report' then update public.user_reports set status='reviewed' where id=p_id;
 elsif p_action='suspend' then update public.users set verification_status='suspended' where id=p_id and role<>'admin';
 elsif p_action='restore' then update public.users set verification_status='unverified' where id=p_id and verification_status='suspended';
 elsif p_action='hide_review' then update public.direct_reviews set visible=false where deal_id=p_id and challenged;
 elsif p_action in ('ads_enabled','ads_home','ads_search','ads_device','ads_guides') then
  update public.ad_settings set enabled=case when p_action='ads_enabled' then p_enabled else enabled end,home=case when p_action='ads_home' then p_enabled else home end,search=case when p_action='ads_search' then p_enabled else search end,device=case when p_action='ads_device' then p_enabled else device end,guides=case when p_action='ads_guides' then p_enabled else guides end;
 elsif p_action in ('category_celular','category_notebook','category_consola') then update public.market_categories set enabled=p_enabled where code=replace(p_action,'category_','');
 else raise exception 'unknown_admin_action';end if;
end;$$;
create function private.report_hides_ads() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.devices set ad_eligible=false where id=new.device_id; return new;end;$$;
create trigger report_hides_ads after insert on public.listing_reports for each row execute function private.report_hides_ads();
revoke all on function private.report_hides_ads() from public;
create or replace function public.public_reputation(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',u.display_name,'joined',u.created_at,'verification',u.verification_status,
 'sales',(select count(*) from public.direct_deals where seller_id=u.id and status='completed'),
 'purchases',(select count(*) from public.direct_deals where buyer_id=u.id and status='completed'),
 'seller_rating',(select avg(rating) from public.direct_reviews where subject_id=u.id and subject_role='seller' and visible and not challenged),
 'buyer_rating',(select avg(rating) from public.direct_reviews where subject_id=u.id and subject_role='buyer' and visible and not challenged))
 from public.users u where u.id=p_user
$$;
revoke all on function public.start_conversation(uuid) from public,anon,authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
revoke all on function public.send_message(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.send_message(uuid,text,uuid) to authenticated;
revoke all on function public.make_offer(uuid,numeric) from public,anon,authenticated;
grant execute on function public.make_offer(uuid,numeric) to authenticated;
revoke all on function public.answer_offer(uuid,text) from public,anon,authenticated;
grant execute on function public.answer_offer(uuid,text) to authenticated;
revoke all on function public.market_action(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.market_action(text,uuid,jsonb) to authenticated;
revoke all on function public.moderate_marketplace(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.moderate_marketplace(uuid,text,text,boolean) to authenticated;
commit;
