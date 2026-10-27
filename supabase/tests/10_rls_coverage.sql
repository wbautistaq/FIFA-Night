-- Falla si alguna tabla de public no tiene RLS activado o no tiene ninguna política.
do $$
declare r record; v_bad text := '';
begin
  for r in
    select c.relname, c.relrowsecurity,
           (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    if not r.relrowsecurity or r.policies = 0 then v_bad := v_bad || r.relname || ' '; end if;
  end loop;
  if v_bad <> '' then raise exception 'Tablas sin RLS/políticas: %', v_bad; end if;
  raise notice 'RLS OK en todas las tablas de public';
end $$;

-- Las funciones internas no deben ser ejecutables por clientes
do $$
begin
  if has_function_privilege('authenticated', 'process_match(uuid)', 'execute') then raise exception 'process_match expuesta'; end if;
  if has_function_privilege('anon', 'start_tournament(uuid,jsonb,jsonb)', 'execute') then raise exception 'start_tournament expuesta a anon'; end if;
  if has_function_privilege('anon', 'confirm_draw(uuid)', 'execute') then raise exception 'confirm_draw expuesta a anon'; end if;
end $$;
