/**
 * Avatares de jugador: una foto subida a Supabase Storage o un emoticono gamer preestablecido.
 * Los emoticonos se guardan en la columna `avatar_url` con el prefijo `emoji:` y se dibujan con
 * Microsoft Fluent Emoji 3D (licencia MIT), iguales en todos los dispositivos.
 */

// Versión fija del repositorio microsoft/fluentui-emoji servida por jsDelivr
const FLUENT_BASE = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets";

/** URL de la imagen 3D de Fluent Emoji para una carpeta del repositorio (p. ej. "Video game"). */
export function fluentEmojiUrl(folder: string, variant?: "Default"): string {
  const file = `${folder.toLowerCase().replace(/ /g, "_")}_3d${variant ? "_default" : ""}.png`;
  return `${FLUENT_BASE}/${encodeURIComponent(folder)}/${variant ? "Default/" : ""}3D/${file}`;
}

export const GAMER_AVATARS = [
  { emoji: "🎮", label: "Mando", img: fluentEmojiUrl("Video game") },
  { emoji: "🕹️", label: "Joystick", img: fluentEmojiUrl("Joystick") },
  { emoji: "👾", label: "Invasor", img: fluentEmojiUrl("Alien monster") },
  { emoji: "🤖", label: "Robot", img: fluentEmojiUrl("Robot") },
  { emoji: "👽", label: "Alien", img: fluentEmojiUrl("Alien") },
  { emoji: "🥷", label: "Ninja", img: fluentEmojiUrl("Ninja", "Default") },
  { emoji: "👻", label: "Fantasma", img: fluentEmojiUrl("Ghost") },
  { emoji: "💀", label: "Calavera", img: fluentEmojiUrl("Skull") },
  { emoji: "😈", label: "Diablillo", img: fluentEmojiUrl("Smiling face with horns") },
  { emoji: "🤡", label: "Payaso", img: fluentEmojiUrl("Clown face") },
  { emoji: "😎", label: "Crack", img: fluentEmojiUrl("Smiling face with sunglasses") },
  { emoji: "🤠", label: "Vaquero", img: fluentEmojiUrl("Cowboy hat face") },
  { emoji: "🤯", label: "Mente explotada", img: fluentEmojiUrl("Exploding head") },
  { emoji: "👑", label: "Rey", img: fluentEmojiUrl("Crown") },
  { emoji: "🐐", label: "GOAT", img: fluentEmojiUrl("Goat") },
  { emoji: "🦁", label: "León", img: fluentEmojiUrl("Lion") },
  { emoji: "🐺", label: "Lobo", img: fluentEmojiUrl("Wolf") },
  { emoji: "🦊", label: "Zorro", img: fluentEmojiUrl("Fox") },
  { emoji: "🐼", label: "Panda", img: fluentEmojiUrl("Panda") },
  { emoji: "🦅", label: "Águila", img: fluentEmojiUrl("Eagle") },
  { emoji: "🦈", label: "Tiburón", img: fluentEmojiUrl("Shark") },
  { emoji: "🐙", label: "Pulpo", img: fluentEmojiUrl("Octopus") },
  { emoji: "🐉", label: "Dragón", img: fluentEmojiUrl("Dragon") },
  { emoji: "🦖", label: "T-Rex", img: `${FLUENT_BASE}/T-rex/3D/t-rex_3d.png` },
  { emoji: "🦄", label: "Unicornio", img: fluentEmojiUrl("Unicorn") },
  { emoji: "⚽", label: "Balón", img: fluentEmojiUrl("Soccer ball") },
  { emoji: "🥅", label: "Portería", img: fluentEmojiUrl("Goal net") },
  { emoji: "🏆", label: "Copa", img: fluentEmojiUrl("Trophy") },
  { emoji: "🔥", label: "Fuego", img: fluentEmojiUrl("Fire") },
  { emoji: "⚡", label: "Rayo", img: fluentEmojiUrl("High voltage") },
  { emoji: "🚀", label: "Cohete", img: fluentEmojiUrl("Rocket") },
  { emoji: "🎯", label: "Diana", img: fluentEmojiUrl("Bullseye") },
  { emoji: "💯", label: "Cien", img: fluentEmojiUrl("Hundred points") },
] as const;

const PREFIX = "emoji:";
const BY_EMOJI = new Map<string, (typeof GAMER_AVATARS)[number]>(GAMER_AVATARS.map((a) => [a.emoji, a]));

export const emojiAvatar = (emoji: string) => `${PREFIX}${emoji}`;

/** Devuelve el emoticono si el valor es un avatar emoji válido de la lista. */
export function avatarEmoji(value: string | null | undefined): string | null {
  if (!value?.startsWith(PREFIX)) return null;
  const e = value.slice(PREFIX.length);
  return BY_EMOJI.has(e) ? e : null;
}

/** Imagen 3D del avatar emoji (null si no es un avatar emoji válido). */
export function avatarEmojiImage(value: string | null | undefined): { img: string; label: string } | null {
  const e = avatarEmoji(value);
  const a = e ? BY_EMOJI.get(e) : undefined;
  return a ? { img: a.img, label: a.label } : null;
}

export const isValidEmojiAvatar = (value: string) => avatarEmoji(value) !== null;

/** Reacciones del muro con la misma estética 3D. */
export const REACTION_IMAGES: Record<string, string> = {
  fire: fluentEmojiUrl("Fire"),
  laugh: fluentEmojiUrl("Face with tears of joy"),
  celebrate: fluentEmojiUrl("Party popper"),
  cry: fluentEmojiUrl("Loudly crying face"),
  surprise: fluentEmojiUrl("Face with open mouth"),
};
