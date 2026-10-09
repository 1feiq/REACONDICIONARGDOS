begin;
update storage.buckets set file_size_limit=2097152, allowed_mime_types=array['image/webp','image/jpeg'] where id='device-photos';
-- Only the server can upload after decoding, resizing and stripping metadata.
drop policy if exists upload_own_photo on storage.objects;
commit;
