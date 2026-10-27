-- FIFA Night · estrellas de clubes según la revelación oficial de EA SPORTS FC 27 (agosto 2026)
-- 5★ (8): PSG, Real Madrid, Manchester City, Bayern, Barcelona, Arsenal, Liverpool, Atlético de Madrid
-- 4.5★ (8): Juventus, Manchester United, Chelsea, Napoli, Borussia Dortmund, Roma, Tottenham, Aston Villa
-- Solo cambia lo confirmado: Atlético sube a 5★ e Inter (fuera de los 5★) baja a 4.5★.
-- Solo el banco global; los equipos propios de cada torneo no se tocan.
update fifa_teams set stars = 5, rating = 86 where tournament_id is null and name = 'Atlético de Madrid';
update fifa_teams set stars = 4.5, rating = 84 where tournament_id is null and name = 'Inter';
