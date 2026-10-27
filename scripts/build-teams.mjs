// Genera data/teams.json y el seed SQL de equipos: clubes de las 5 grandes ligas y selecciones de EA SPORTS FC 26.
// Estrellas de clubes según la lista pública de valoraciones de FC 26 (fifagamenews.com/fc-26-team-star-ratings).
// Las selecciones no tienen fuente pública fiable: sus estrellas son una estimación y conviene revisarlas.
// Sin escudos oficiales: la app dibuja un escudo propio con los colores de cada equipo.
import { writeFileSync } from "node:fs";

// [nombre, código, estrellas, color principal, color secundario]
const leagues = {
  "Premier League|Inglaterra": [
    ["Arsenal", "ARS", 5, "#EF0107", "#FFFFFF"],
    ["Liverpool", "LIV", 5, "#C8102E", "#F6EB61"],
    ["Manchester City", "MCI", 5, "#6CABDD", "#1C2C5B"],
    ["Chelsea", "CHE", 4.5, "#034694", "#FFFFFF"],
    ["Newcastle United", "NEW", 4.5, "#241F20", "#FFFFFF"],
    ["Tottenham Hotspur", "TOT", 4.5, "#132257", "#FFFFFF"],
    ["Aston Villa", "AVL", 4.5, "#670E36", "#95BFE5"],
    ["Manchester United", "MUN", 4.5, "#DA291C", "#FBE122"],
    ["Nottingham Forest", "NFO", 4.5, "#DD0000", "#FFFFFF"],
    ["Bournemouth", "BOU", 4, "#DA291C", "#000000"],
    ["Brighton & Hove Albion", "BHA", 4, "#0057B8", "#FFFFFF"],
    ["Crystal Palace", "CRY", 4, "#1B458F", "#C4122E"],
    ["West Ham United", "WHU", 4, "#7A263A", "#1BB1E7"],
    ["Brentford", "BRE", 4, "#E30613", "#FFFFFF"],
    ["Fulham", "FUL", 4, "#FFFFFF", "#000000"],
    ["Everton", "EVE", 4, "#003399", "#FFFFFF"],
    ["Leeds United", "LEE", 4, "#FFFFFF", "#1D428A"],
    ["Wolverhampton Wanderers", "WOL", 4, "#FDB913", "#231F20"],
    ["Burnley", "BUR", 3.5, "#6C1D45", "#99D6EA"],
    ["Sunderland", "SUN", 3.5, "#EB172B", "#FFFFFF"],
  ],
  "LaLiga|España": [
    ["Real Madrid", "RMA", 5, "#FFFFFF", "#FEBE10"],
    ["FC Barcelona", "BAR", 5, "#A50044", "#004D98"],
    ["Atlético de Madrid", "ATM", 4.5, "#CB3524", "#272E61"],
    ["Athletic Club", "ATH", 4.5, "#EE2523", "#FFFFFF"],
    ["Real Betis", "BET", 4, "#00954C", "#FFFFFF"],
    ["Real Sociedad", "RSO", 4, "#0067B1", "#FFFFFF"],
    ["Villarreal", "VIL", 4, "#FFE667", "#005187"],
    ["Girona", "GIR", 4, "#CD2534", "#FFFFFF"],
    ["RCD Mallorca", "MLL", 4, "#E20613", "#000000"],
    ["Rayo Vallecano", "RAY", 4, "#FFFFFF", "#E53027"],
    ["Celta de Vigo", "CEL", 4, "#8AC3EE", "#FFFFFF"],
    ["Getafe", "GET", 4, "#005999", "#FFFFFF"],
    ["Osasuna", "OSA", 4, "#D91A21", "#0A346F"],
    ["Sevilla", "SEV", 4, "#FFFFFF", "#D71920"],
    ["Valencia", "VAL", 4, "#FFFFFF", "#EE3524"],
    ["RCD Espanyol", "RCD", 3.5, "#007FC8", "#FFFFFF"],
    ["Deportivo Alavés", "ALA", 3.5, "#0761AF", "#FFFFFF"],
    ["Levante", "LEV", 3.5, "#B4053F", "#004D98"],
    ["Real Oviedo", "OVI", 3.5, "#0033A0", "#FFFFFF"],
    ["Elche", "ELC", 3, "#FFFFFF", "#05642C"],
  ],
  "Serie A|Italia": [
    ["Inter", "INT", 5, "#010E80", "#000000"],
    ["Napoli", "NAP", 4.5, "#12A0D7", "#FFFFFF"],
    ["Juventus", "JUV", 4.5, "#FFFFFF", "#000000"],
    ["AC Milan", "MIL", 4.5, "#FB090B", "#000000"],
    ["AS Roma", "ROM", 4.5, "#8E1F2F", "#F0BC42"],
    ["Atalanta", "ATA", 4.5, "#1E71B8", "#000000"],
    ["Lazio", "LAZ", 4.5, "#87D8F7", "#FFFFFF"],
    ["Bologna", "BOL", 4, "#1A2F48", "#A21C26"],
    ["Fiorentina", "FIO", 4, "#482E92", "#FFFFFF"],
    ["Torino", "TOR", 4, "#8A1E03", "#FFFFFF"],
    ["Como", "COM", 4, "#1B3C78", "#FFFFFF"],
    ["Genoa", "GEN", 3.5, "#AE1919", "#1A2B4C"],
    ["Sassuolo", "SAS", 3.5, "#00A752", "#000000"],
    ["Udinese", "UDI", 3.5, "#FFFFFF", "#000000"],
    ["Cagliari", "CAG", 3.5, "#A50034", "#002350"],
    ["Cremonese", "CRE", 3.5, "#C8102E", "#808080"],
    ["Hellas Verona", "VER", 3.5, "#005395", "#FFE74A"],
    ["Lecce", "LEC", 3.5, "#FFE500", "#E30613"],
    ["Parma", "PAR", 3.5, "#FFD200", "#1B4F9C"],
    ["Pisa", "PIS", 3, "#0A2A5E", "#000000"],
  ],
  "Bundesliga|Alemania": [
    ["FC Bayern München", "FCB", 5, "#DC052D", "#FFFFFF"],
    ["Borussia Dortmund", "BVB", 4.5, "#FDE100", "#000000"],
    ["Bayer 04 Leverkusen", "B04", 4.5, "#E32221", "#000000"],
    ["RB Leipzig", "RBL", 4.5, "#FFFFFF", "#DD0741"],
    ["Eintracht Frankfurt", "SGE", 4, "#000000", "#E1000F"],
    ["VfB Stuttgart", "VFB", 4, "#FFFFFF", "#E32219"],
    ["VfL Wolfsburg", "WOB", 4, "#65B32E", "#FFFFFF"],
    ["Borussia Mönchengladbach", "BMG", 4, "#FFFFFF", "#000000"],
    ["SC Freiburg", "SCF", 4, "#000000", "#E2001A"],
    ["TSG Hoffenheim", "TSG", 4, "#1C63B7", "#FFFFFF"],
    ["FC Augsburg", "FCA", 4, "#BA3733", "#46714D"],
    ["1. FSV Mainz 05", "M05", 4, "#C3141E", "#FFFFFF"],
    ["SV Werder Bremen", "SVW", 4, "#1D9053", "#FFFFFF"],
    ["1. FC Union Berlin", "FCU", 3.5, "#EB1923", "#FFFFFF"],
    ["1. FC Köln", "KOE", 3.5, "#FFFFFF", "#ED1C24"],
    ["1. FC Heidenheim", "FCH", 3.5, "#E30613", "#003B79"],
    ["Hamburger SV", "HSV", 3.5, "#FFFFFF", "#0A3F86"],
    ["FC St. Pauli", "STP", 3.5, "#6F4E37", "#FFFFFF"],
  ],
  "Ligue 1|Francia": [
    ["Paris Saint-Germain", "PSG", 5, "#004170", "#DA291C"],
    ["AS Monaco", "ASM", 4, "#E7001F", "#FFFFFF"],
    ["Olympique de Marseille", "OM", 4, "#FFFFFF", "#2FAEE0"],
    ["LOSC Lille", "LOSC", 4, "#E01E13", "#20325F"],
    ["Paris FC", "PFC", 4, "#1C2C5B", "#FFFFFF"],
    ["OGC Nice", "NIC", 4, "#C8102E", "#000000"],
    ["Olympique Lyonnais", "OL", 4, "#FFFFFF", "#DA001A"],
    ["Stade Rennais", "SRF", 4, "#E13327", "#000000"],
    ["RC Lens", "RCL", 3.5, "#FFE500", "#E30613"],
    ["RC Strasbourg", "RCS", 3.5, "#009FE3", "#FFFFFF"],
    ["Toulouse FC", "TFC", 3.5, "#5B2D82", "#FFFFFF"],
    ["AJ Auxerre", "AJA", 3.5, "#FFFFFF", "#004A99"],
    ["FC Nantes", "FCN", 3.5, "#FCD405", "#00A651"],
    ["Stade Brestois", "SB29", 3.5, "#E30613", "#FFFFFF"],
    ["Le Havre AC", "HAC", 3.5, "#6EB5E6", "#002F5F"],
    ["Angers SCO", "SCO", 3.5, "#000000", "#FFFFFF"],
    ["FC Lorient", "FCL", 3.5, "#F58113", "#000000"],
    ["FC Metz", "FCM", 3, "#7A1530", "#FFFFFF"],
  ],
};

// Estimación (sin fuente pública de estrellas por selección en FC 26)
const nationals = [
  ["Francia", "FRA", 5, "#002654", "#ED2939"], ["España", "ESP", 5, "#AA151B", "#F1BF00"],
  ["Inglaterra", "ENG", 5, "#FFFFFF", "#CF081F"], ["Argentina", "ARG", 5, "#75AADB", "#FFFFFF"],
  ["Portugal", "POR", 5, "#DA291C", "#046A38"], ["Brasil", "BRA", 4.5, "#FFDF00", "#009C3B"],
  ["Alemania", "GER", 4.5, "#FFFFFF", "#000000"], ["Países Bajos", "NED", 4.5, "#FF6200", "#FFFFFF"],
  ["Italia", "ITA", 4.5, "#0066B2", "#FFFFFF"], ["Bélgica", "BEL", 4.5, "#E30613", "#000000"],
  ["Croacia", "CRO", 4, "#FFFFFF", "#E30613"], ["Uruguay", "URU", 4, "#5CBFEB", "#FFFFFF"],
  ["Colombia", "COL", 4, "#FCD116", "#003893"], ["Dinamarca", "DEN", 4, "#C60C30", "#FFFFFF"],
  ["Suiza", "SUI", 4, "#D52B1E", "#FFFFFF"], ["Marruecos", "MAR", 4, "#C1272D", "#006233"],
  ["Estados Unidos", "USA", 4, "#FFFFFF", "#0A3161"], ["México", "MEX", 4, "#006847", "#FFFFFF"],
  ["Senegal", "SEN", 4, "#FFFFFF", "#00853F"], ["Noruega", "NOR", 4, "#BA0C2F", "#FFFFFF"],
  ["Austria", "AUT", 4, "#ED2939", "#FFFFFF"], ["Japón", "JPN", 3.5, "#000555", "#FFFFFF"],
  ["Corea del Sur", "KOR", 3.5, "#C60C30", "#FFFFFF"], ["Ecuador", "ECU", 3.5, "#FFDD00", "#034EA2"],
];

// rating numérico (lo usan el sorteo equilibrado y los FIFA Points) derivado de las estrellas
const ratingFor = (stars) => Math.round(66 + stars * 4);

const teams = [
  ...Object.entries(leagues).flatMap(([key, list]) => {
    const [league, country] = key.split("|");
    return list.map(([name, short_name, stars, color_primary, color_secondary]) => ({ name, short_name, league, country, stars, rating: ratingFor(stars), kind: "club", color_primary, color_secondary }));
  }),
  ...nationals.map(([country, short_name, stars, color_primary, color_secondary]) => ({
    name: country, short_name, league: "Selecciones", country, stars, rating: ratingFor(stars), kind: "national", color_primary, color_secondary,
  })),
];

writeFileSync("data/teams.json", JSON.stringify(teams, null, 2) + "\n");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const rows = teams.map((t) => `(${q(t.name)},${q(t.short_name)},${q(t.league)},${q(t.country)},${t.rating},${t.stars},${q(t.kind)},${q(t.color_primary)},${q(t.color_secondary)})`);
writeFileSync("supabase/seed.sql",
  `-- Generado por scripts/build-teams.mjs — clubes de las 5 grandes ligas y selecciones de EA SPORTS FC 26\ninsert into fifa_teams (name, short_name, league, country, rating, stars, kind, color_primary, color_secondary) values\n${rows.join(",\n")}\non conflict do nothing;\n`);
console.log(teams.length, "equipos");
