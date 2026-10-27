-- FIFA Night · predicciones sobre partidos sin resultado
-- Con el left join, r.status es null para partidos aún no jugados: `settled = (r.status = 'confirmed')` daba null
-- y violaba el NOT NULL, haciendo fallar la confirmación de cualquier resultado del torneo.
create or replace function settle_predictions(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_exact boolean;
begin
  select coalesce((settings->>'exact_score_predictions')::boolean, true) into v_exact from tournaments where id = p_tournament;
  update predictions p set
    settled = coalesce(r.status = 'confirmed', false),
    points = case when r.status is distinct from 'confirmed' then 0 else
      (case when p.predicted_winner_id is not distinct from result_winner(r, m) then 3 else 0 end)
      + (case when v_exact and p.home_score = r.home_score and p.away_score = r.away_score then 2 else 0 end) end
  from matches m left join match_results r on r.match_id = m.id
  where p.match_id = m.id and p.tournament_id = p_tournament;
end $$;
revoke all on function settle_predictions(uuid) from public, anon, authenticated;
