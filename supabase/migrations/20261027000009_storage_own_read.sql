-- FIFA Night · Storage: la API de subida necesita leer la fila recién creada (y para upsert, actualizarla).
-- Solo sobre la carpeta propia del usuario: nadie puede listar archivos ajenos; las URLs públicas siguen funcionando.
create policy "fifa_night_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'fifa-night' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fifa_night_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'fifa-night' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fifa-night' and (storage.foldername(name))[1] = (select auth.uid())::text);
