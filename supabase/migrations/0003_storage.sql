-- 0003_storage.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/webp','image/jpeg','image/png']) on conflict (id) do nothing;
create policy "public read event images" on storage.objects for select to anon, authenticated using (bucket_id = 'event-images');
