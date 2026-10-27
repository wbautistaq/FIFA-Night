/**
 * Escudos "inspirados" en cada equipo: forma general, patrón con sus colores y un emblema genérico
 * relacionado con su apodo o su ciudad (ave, felino, corona, castillo…).
 * No reproducen elementos distintivos de los escudos oficiales (marcas registradas): solo evocan al club.
 */
export type CrestShape = "shield" | "heater" | "round" | "oval" | "badge";
export type CrestPattern =
  | "solid" | "stripes" | "hoops" | "halves" | "sash" | "quarters" | "chevron" | "cross" | "nordic"
  | "diamonds" | "checks" | "ring" | "tri-v" | "tri-h" | "rhombus";
export type CrestSymbol =
  | "bird" | "cat" | "wolf" | "horse" | "bull" | "fish" | "bug" | "butterfly" | "paw"
  | "crown" | "star" | "ball" | "castle" | "anchor" | "ship" | "lightning" | "fire" | "tree" | "pine" | "palm"
  | "flower" | "lily" | "sun" | "cross" | "diamond" | "hammer" | "key" | "bell" | "gear" | "acorn" | "skull"
  | "mountains" | "waves" | "lighthouse" | "feather" | "target" | "building" | "none";

export interface CrestSpec {
  shape: CrestShape;
  pattern: CrestPattern;
  symbol: CrestSymbol;
  /** Colores propios del escudo (banderas de selecciones); si faltan se usan los del equipo. */
  colors?: string[];
}

// "forma patrón emblema [colores…]"
const SPECS: Record<string, string> = {
  // Premier League
  "Arsenal": "round ring target",
  "Liverpool": "shield solid bird",
  "Manchester City": "round ring ship",
  "Chelsea": "round ring cat",
  "Newcastle United": "shield stripes bird",
  "Tottenham Hotspur": "oval solid bird",
  "Aston Villa": "heater solid cat",
  "Manchester United": "shield solid fire",
  "Nottingham Forest": "round solid tree",
  "Bournemouth": "shield stripes star",
  "Brighton & Hove Albion": "round stripes bird",
  "Crystal Palace": "oval halves bird",
  "West Ham United": "shield halves hammer",
  "Brentford": "round stripes bug",
  "Fulham": "shield solid star",
  "Everton": "shield solid castle",
  "Leeds United": "round ring flower",
  "Wolverhampton Wanderers": "shield solid wolf",
  "Burnley": "shield halves crown",
  "Sunderland": "shield stripes cat",
  // LaLiga
  "Real Madrid": "round ring crown",
  "FC Barcelona": "heater stripes ball",
  "Atlético de Madrid": "shield stripes paw",
  "Athletic Club": "shield stripes tree",
  "Real Betis": "round stripes star",
  "Real Sociedad": "round stripes crown",
  "Villarreal": "shield solid anchor",
  "Girona": "shield stripes diamond",
  "RCD Mallorca": "shield solid castle",
  "Rayo Vallecano": "shield sash lightning",
  "Celta de Vigo": "shield solid cross",
  "Getafe": "round solid star",
  "Osasuna": "shield solid crown",
  "Sevilla": "heater quarters crown",
  "Valencia": "round solid bird",
  "RCD Espanyol": "shield stripes bird",
  "Deportivo Alavés": "shield stripes castle",
  "Levante": "shield stripes waves",
  "Real Oviedo": "shield solid crown",
  "Elche": "shield sash palm",
  // Serie A
  "Inter": "round ring star",
  "Napoli": "round ring horse",
  "Juventus": "oval stripes star",
  "AC Milan": "oval stripes cross",
  "AS Roma": "shield halves wolf",
  "Atalanta": "round stripes feather",
  "Lazio": "shield solid bird",
  "Bologna": "shield halves cross",
  "Fiorentina": "shield solid lily",
  "Torino": "shield solid bull",
  "Como": "shield solid ship",
  "Genoa": "shield halves bird",
  "Sassuolo": "shield stripes star",
  "Udinese": "shield stripes bird",
  "Cagliari": "shield halves sun",
  "Cremonese": "round stripes bell",
  "Hellas Verona": "shield hoops key",
  "Lecce": "shield stripes wolf",
  "Parma": "shield cross cross",
  "Pisa": "shield solid building",
  // Bundesliga
  "FC Bayern München": "round diamonds mountains",
  "Borussia Dortmund": "round solid star",
  "Bayer 04 Leverkusen": "round ring lightning",
  "RB Leipzig": "oval solid horse",
  "Eintracht Frankfurt": "shield solid bird",
  "VfB Stuttgart": "shield hoops horse",
  "VfL Wolfsburg": "round solid wolf",
  "Borussia Mönchengladbach": "shield solid horse",
  "SC Freiburg": "round solid pine",
  "TSG Hoffenheim": "shield solid crown",
  "FC Augsburg": "round halves acorn",
  "1. FSV Mainz 05": "round solid gear",
  "SV Werder Bremen": "badge solid anchor",
  "1. FC Union Berlin": "shield stripes hammer",
  "1. FC Köln": "shield solid bull",
  "1. FC Heidenheim": "shield halves mountains",
  "Hamburger SV": "badge solid anchor",
  "FC St. Pauli": "shield solid skull",
  // Ligue 1
  "Paris Saint-Germain": "round ring crown",
  "AS Monaco": "shield sash crown",
  "Olympique de Marseille": "shield solid star",
  "LOSC Lille": "round solid paw",
  "Paris FC": "round ring ship",
  "OGC Nice": "shield stripes bird",
  "Olympique Lyonnais": "round solid cat",
  "Stade Rennais": "shield halves feather",
  "RC Lens": "shield halves hammer",
  "RC Strasbourg": "shield sash star",
  "Toulouse FC": "oval solid cross",
  "AJ Auxerre": "shield solid bird",
  "FC Nantes": "shield solid bird",
  "Stade Brestois": "shield solid anchor",
  "Le Havre AC": "shield halves lighthouse",
  "Angers SCO": "shield stripes castle",
  "FC Lorient": "round solid fish",
  "FC Metz": "shield halves cross",
  // Selecciones: colores de la bandera y un emblema genérico
  "Francia": "badge tri-v star #002654 #FFFFFF #ED2939",
  "España": "badge tri-h crown #AA151B #F1BF00 #AA151B",
  "Inglaterra": "badge cross cat #FFFFFF #CF081F",
  "Argentina": "badge tri-h sun #75AADB #FFFFFF #75AADB",
  "Portugal": "badge halves star #046A38 #DA291C",
  "Brasil": "badge rhombus star #009C3B #FFDF00",
  "Alemania": "badge tri-h bird #000000 #DD0000 #FFCE00",
  "Países Bajos": "badge tri-h cat #AE1C28 #FFFFFF #21468B",
  "Italia": "badge tri-v star #009246 #FFFFFF #CE2B37",
  "Bélgica": "badge tri-v cat #000000 #FDDA24 #EF3340",
  "Croacia": "badge checks none #E30613 #FFFFFF",
  "Uruguay": "badge hoops sun #FFFFFF #0038A8",
  "Colombia": "badge tri-h bird #FCD116 #003893 #CE1126",
  "Dinamarca": "badge nordic star #C60C30 #FFFFFF",
  "Suiza": "badge solid cross #D52B1E",
  "Marruecos": "badge solid star #C1272D",
  "Estados Unidos": "badge hoops star #B22234 #FFFFFF",
  "México": "badge tri-v bird #006847 #FFFFFF #CE1126",
  "Senegal": "badge tri-v star #00853F #FDEF42 #E31B23",
  "Noruega": "badge nordic star #BA0C2F #FFFFFF",
  "Austria": "badge tri-h bird #ED2939 #FFFFFF #ED2939",
  "Japón": "badge solid sun #FFFFFF",
  "Corea del Sur": "badge solid cat #FFFFFF",
  "Ecuador": "badge tri-h bird #FFDD00 #034EA2 #ED1C24",
};

const SHAPES: CrestShape[] = ["shield", "heater", "round", "oval", "badge"];
const PATTERNS: CrestPattern[] = ["solid", "stripes", "halves", "sash", "hoops", "chevron"];
const SYMBOLS: CrestSymbol[] = ["star", "bird", "crown", "lightning", "castle", "cat", "fire", "ball"];

/** Escudo de un equipo: el definido para el banco FC 26 o uno estable derivado del nombre (equipos propios). */
export function crestFor(name: string): CrestSpec {
  const raw = SPECS[name];
  if (raw) {
    const [shape, pattern, symbol, ...colors] = raw.split(" ");
    return { shape: shape as CrestShape, pattern: pattern as CrestPattern, symbol: symbol as CrestSymbol, colors: colors.length ? colors : undefined };
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { shape: SHAPES[h % SHAPES.length]!, pattern: PATTERNS[(h >> 3) % PATTERNS.length]!, symbol: SYMBOLS[(h >> 6) % SYMBOLS.length]! };
}
