begin;
create table private.retired_photos(path text primary key);
alter table private.retired_photos enable row level security;
revoke all on private.retired_photos from public,anon,authenticated;

create function private.reject_retired_photos() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.retired_photos r where r.path=any(new.photo_paths)) then
   raise exception 'photo_expired_upload_again';
 end if;
 return new;
end;$$;
revoke all on function private.reject_retired_photos() from public;
create trigger reject_retired_photos before insert or update of photo_paths on public.devices
for each row execute function private.reject_retired_photos();

create function public.claim_abandoned_photos() returns table(path text)
language plpgsql security definer set search_path='' as $$
begin
 -- Prevent a listing from attaching a photo between checking and retiring it.
 lock table public.devices in share row exclusive mode;
 insert into private.retired_photos(path)
 select o.name from storage.objects o where o.bucket_id='device-photos'
 and o.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.devices d where o.name=any(d.photo_paths))
 order by o.created_at limit 100 on conflict do nothing;
 -- Keep failed deletions retryable; never delete Storage metadata directly.
 return query select r.path from private.retired_photos r join storage.objects o
 on o.bucket_id='device-photos' and o.name=r.path limit 100;
end;$$;
revoke all on function public.claim_abandoned_photos() from public,anon,authenticated;
grant execute on function public.claim_abandoned_photos() to service_role;
commit;
