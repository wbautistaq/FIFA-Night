-- FIFA Night · seguridad: las llaves de invitado salen de tournament_participants
-- Antes, cualquier miembro del torneo podía leer guest_token de los demás (por la API y por Realtime)
-- y hacerse pasar por ellos. Ahora viven en una tabla sin permisos para usuarios: solo el servidor las lee.

create table participant_tokens (
  participant_id uuid primary key references tournament_participants(id) on delete cascade,
  -- 48 caracteres hexadecimales (el formato que valida la app)
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 16)),
  created_at timestamptz not null default now()
);
alter table participant_tokens enable row level security;
revoke all on participant_tokens from anon, authenticated;

-- Conserva las llaves actuales: los invitados que ya se unieron siguen entrando igual
insert into participant_tokens (participant_id, token)
select id, guest_token from tournament_participants where guest_token is not null;

-- Cada participante nuevo recibe su llave automáticamente
create function create_participant_token() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into participant_tokens (participant_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger participants_token after insert on tournament_participants for each row execute function create_participant_token();
revoke all on function create_participant_token() from public, anon, authenticated;

-- La protección de datos del jugador ya no menciona la columna eliminada
create or replace function guard_participant_update() returns trigger language plpgsql set search_path = public as $$
begin
  if is_service() or is_organizer(old.tournament_id) then return new; end if;
  if (new.tournament_id, new.user_id, new.role, new.seed, new.group_name)
     is distinct from (old.tournament_id, old.user_id, old.role, old.seed, old.group_name) then
    raise exception 'Solo puedes editar tus datos de presentación' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function guard_participant_update() from public, anon, authenticated;

alter table tournament_participants drop column guest_token;
