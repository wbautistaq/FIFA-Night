-- Modo TV controlable desde el celular del organizador: el estado vive en el torneo y llega por Realtime/sondeo
alter table tournaments add column tv_state jsonb not null default '{"view":"auto"}'::jsonb
  check (jsonb_typeof(tv_state) = 'object' and (tv_state->>'view') in ('auto','next','standings','bracket','scorers','results'));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table tournaments;
  end if;
end $$;
