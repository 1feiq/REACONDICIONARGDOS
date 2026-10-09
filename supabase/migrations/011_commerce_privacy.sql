begin;
-- Provider references can contain sensitive identifiers; expose only the result.
revoke select on public.device_checks from anon,authenticated;
grant select(id,device_id,source,result,checked_at) on public.device_checks to anon,authenticated;
create function private.limit_commerce_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=case when tg_table_name='order_messages' then new.author_id else new.reporter_id end;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,741));
 if tg_table_name='order_messages' then
  if (select count(*) from public.order_messages where author_id=actor and created_at>now()-interval '1 hour')>=30 then raise exception 'message_limit'; end if;
 else
  if (select count(*) from public.listing_reports where reporter_id=actor and created_at>now()-interval '1 day')>=10 then raise exception 'report_limit'; end if;
 end if;
 return new;
end;$$;
create trigger message_rate_limit before insert on public.order_messages for each row execute function private.limit_commerce_activity();
create trigger report_rate_limit before insert on public.listing_reports for each row execute function private.limit_commerce_activity();
revoke all on function private.limit_commerce_activity() from public;
commit;
