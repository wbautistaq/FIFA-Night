"use client";

import { useId, type ReactNode } from "react";
import {
  Acorn, Anchor, Bell, Bird, Bug, Building, Butterfly, CastleTurret, Cat, Cow, Cross, Crosshair, Crown, Diamond, Dog, Feather,
  Fire, Fish, Flower, FlowerLotus, Gear, Hammer, Horse, Key, Lighthouse, Lightning, Mountains, PawPrint, Sailboat, Skull,
  SoccerBall, Star, Sun, Tree, TreeEvergreen, TreePalm, Waves, type Icon,
} from "@phosphor-icons/react";
import { crestFor, type CrestPattern, type CrestShape, type CrestSymbol } from "@/lib/crests";
import { teamStars } from "@/lib/teams";
import type { Team } from "@/lib/types";

const SYMBOL_ICON: Record<Exclude<CrestSymbol, "none">, Icon> = {
  bird: Bird, cat: Cat, wolf: Dog, horse: Horse, bull: Cow, fish: Fish, bug: Bug, butterfly: Butterfly, paw: PawPrint,
  crown: Crown, star: Star, ball: SoccerBall, castle: CastleTurret, anchor: Anchor, ship: Sailboat, lightning: Lightning,
  fire: Fire, tree: Tree, pine: TreeEvergreen, palm: TreePalm, flower: Flower, lily: FlowerLotus, sun: Sun, cross: Cross,
  diamond: Diamond, hammer: Hammer, key: Key, bell: Bell, gear: Gear, acorn: Acorn, skull: Skull, mountains: Mountains,
  waves: Waves, lighthouse: Lighthouse, feather: Feather, target: Crosshair, building: Building,
};

// Siluetas en un lienzo de 40×46
const SHAPE_PATH: Record<CrestShape, string> = {
  shield: "M20 1.5 37 7v14.5c0 10-7.3 17.6-17 22.3C10.3 39.1 3 31.5 3 21.5V7z",
  heater: "M4 3h32v17c0 11.5-8 19.5-16 24C12 39.5 4 31.5 4 20z",
  round: "M20 4a18 18 0 1 1 0 36a18 18 0 1 1 0-36z",
  oval: "M20 2c9 0 16 8.9 16 20s-7 20-16 20S4 33.1 4 22 11 2 20 2z",
  badge: "M7 2h26a3 3 0 0 1 3 3v22L20 44 4 27V5a3 3 0 0 1 3-3z",
};

function Pattern({ pattern, c }: { pattern: CrestPattern; c: string[] }) {
  const [a = "#6d28d9", b = "#ffffff", d = a] = c;
  const base = <rect width="40" height="46" fill={a} />;
  switch (pattern) {
    case "stripes": return <>{base}{[5, 15, 25, 35].map((x) => <rect key={x} x={x} width="5" height="46" fill={b} />)}</>;
    case "hoops": return <>{base}{[6, 16, 26, 36].map((y) => <rect key={y} y={y} width="40" height="5" fill={b} />)}</>;
    case "halves": return <>{base}<rect x="20" width="20" height="46" fill={b} /></>;
    case "sash": return <>{base}<path d="M-4 8 8 -4 44 34 32 46z" fill={b} /></>;
    case "quarters": return <>{base}<rect width="20" height="23" fill={b} /><rect x="20" y="23" width="20" height="23" fill={b} /></>;
    case "chevron": return <>{base}<path d="M0 14 20 26 40 14v8L20 34 0 22z" fill={b} /></>;
    case "cross": return <>{base}<rect x="16.5" width="7" height="46" fill={b} /><rect y="18.5" width="40" height="7" fill={b} /></>;
    case "nordic": return <>{base}<rect x="11" width="6" height="46" fill={b} /><rect y="17" width="40" height="6" fill={b} /></>;
    case "diamonds": return <>{base}{Array.from({ length: 30 }, (_, i) => { const x = (i % 6) * 8 - 2 + (Math.floor(i / 6) % 2) * 4; const y = Math.floor(i / 6) * 10; return <path key={i} d={`M${x} ${y + 5}l4-5 4 5-4 5z`} fill={b} />; })}</>;
    case "checks": return <>{base}{Array.from({ length: 48 }, (_, i) => ((i % 6) + Math.floor(i / 6)) % 2 ? <rect key={i} x={(i % 6) * 7} y={Math.floor(i / 6) * 6} width="7" height="6" fill={b} /> : null)}</>;
    case "ring": return <><rect width="40" height="46" fill={b} /><circle cx="20" cy="22" r="13" fill={a} /></>;
    case "tri-v": return <><rect width="14" height="46" fill={a} /><rect x="13.3" width="13.4" height="46" fill={b} /><rect x="26.7" width="13.3" height="46" fill={d} /></>;
    case "tri-h": return <><rect width="40" height="16" fill={a} /><rect y="15.5" width="40" height="15" fill={b} /><rect y="30" width="40" height="16" fill={d} /></>;
    case "rhombus": return <>{base}<path d="M20 7 36 22 20 37 4 22z" fill={b} /></>;
    default: return base;
  }
}

/** Escudo dibujado del equipo (sin escudos oficiales). Decorativo: el nombre del equipo siempre va en texto al lado. */
export function CrestSvg({ team, size }: { team: Pick<Team, "name" | "short_name" | "color_primary" | "color_secondary">; size: number }) {
  const uid = useId().replace(/:/g, "");
  const spec = crestFor(team.name);
  const colors = spec.colors ?? [team.color_primary, team.color_secondary];
  const path = SHAPE_PATH[spec.shape];
  const SymbolIcon = spec.symbol === "none" ? null : SYMBOL_ICON[spec.symbol];
  return (
    <svg aria-hidden width={size} height={size * 1.15} viewBox="0 0 40 46" className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,.55)]">
      <defs>
        <clipPath id={`c${uid}`}><path d={path} /></clipPath>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".32" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".18" /></linearGradient>
      </defs>
      <g clipPath={`url(#c${uid})`}>
        <Pattern pattern={spec.pattern} c={colors} />
        <rect width="40" height="46" fill={`url(#g${uid})`} />
        {/* Placa oscura detrás del emblema: contraste constante sobre cualquier color */}
        {SymbolIcon ? <circle cx="20" cy="22" r="9.5" fill="rgba(7,6,26,.62)" /> : <rect x="6" y="16.5" width="28" height="11" rx="3" fill="rgba(7,6,26,.75)" />}
      </g>
      <path d={path} fill="none" stroke="rgba(255,255,255,.65)" strokeWidth="1.5" />
      {SymbolIcon ? (
        <SymbolIcon x={12.5} y={14.5} width={15} height={15} weight="fill" color="#ffffff" />
      ) : (
        <text x="20" y="22.5" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-display)" fontSize={team.short_name.length > 3 ? 7.5 : 9} fill="#ffffff" letterSpacing=".4">{team.short_name}</text>
      )}
    </svg>
  );
}

/** Estrellas en miniatura bajo el escudo: 5 iconos si hay espacio, formato compacto «4.5★» si es pequeño. */
function MiniStars({ value, width }: { value: number; width: number }) {
  if (width < 34) {
    return <span className="font-display text-[9px] leading-none text-amber-300">{value}<Star size={8} weight="fill" className="-mt-px ml-px inline" aria-hidden /></span>;
  }
  const s = Math.max(6, Math.min(11, Math.floor(width / 6)));
  return (
    <span className="flex leading-none text-amber-300">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={s} weight={value >= i ? "fill" : value >= i - 0.5 ? "duotone" : "regular"} className={value >= i - 0.5 ? undefined : "text-white/25"} aria-hidden />)}
    </span>
  );
}

/** Escudo + estrellas FC 26. Las estrellas se anuncian como texto para lectores de pantalla. */
export function TeamCrest({ team, size = 36, stars = true, children }: {
  team: Pick<Team, "name" | "short_name" | "color_primary" | "color_secondary" | "stars" | "rating">;
  size?: number;
  stars?: boolean;
  children?: ReactNode;
}) {
  const value = teamStars(team);
  return (
    <span className="relative inline-flex shrink-0 flex-col items-center gap-0.5">
      <CrestSvg team={team} size={size} />
      {stars ? <><MiniStars value={value} width={size} /><span className="sr-only">{value} estrellas</span></> : null}
      {children}
    </span>
  );
}
