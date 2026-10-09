insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('device-photos','device-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy upload_own_photo on storage.objects for insert to authenticated
with check(bucket_id='device-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy delete_own_photo on storage.objects for delete to authenticated
using(bucket_id='device-photos' and owner_id=auth.uid()::text);
-- Photos are intentionally public: never upload documents or contact screenshots.
