begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-evidence','order-evidence',false,2097152,array['image/webp','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/webp','image/jpeg'];
create policy evidence_private_read on storage.objects for select to authenticated using(
 bucket_id='order-evidence' and exists(select 1 from public.order_evidence e where e.path=name and private.order_member(e.order_id))
);
-- Uploads only through the authenticated server action; no public write policy.
commit;

