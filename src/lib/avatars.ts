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

export const AVATAR_GROUPS = [
  { id: "juego", label: "Juego y poder" },
  { id: "personajes", label: "Personajes" },
  { id: "caras", label: "Caras" },
  { id: "animales", label: "Animales" },
  { id: "deporte", label: "Fútbol y deporte" },
] as const;

export const GAMER_AVATARS = [
  // Juego y poder
  { emoji: "🎮", label: "Mando", group: "juego", img: fluentEmojiUrl("Video game") },
  { emoji: "🕹️", label: "Joystick", group: "juego", img: fluentEmojiUrl("Joystick") },
  { emoji: "👾", label: "Invasor", group: "juego", img: fluentEmojiUrl("Alien monster") },
  { emoji: "🎯", label: "Diana", group: "juego", img: fluentEmojiUrl("Bullseye") },
  { emoji: "💯", label: "Cien", group: "juego", img: fluentEmojiUrl("Hundred points") },
  { emoji: "🔥", label: "Fuego", group: "juego", img: fluentEmojiUrl("Fire") },
  { emoji: "⚡", label: "Rayo", group: "juego", img: fluentEmojiUrl("High voltage") },
  { emoji: "🚀", label: "Cohete", group: "juego", img: fluentEmojiUrl("Rocket") },
  { emoji: "👑", label: "Rey", group: "juego", img: fluentEmojiUrl("Crown") },
  { emoji: "⚔️", label: "Espadas", group: "juego", img: fluentEmojiUrl("Crossed swords") },
  { emoji: "🛡️", label: "Escudo", group: "juego", img: fluentEmojiUrl("Shield") },
  { emoji: "🏹", label: "Arco", group: "juego", img: fluentEmojiUrl("Bow and arrow") },
  { emoji: "🪄", label: "Varita mágica", group: "juego", img: fluentEmojiUrl("Magic wand") },
  { emoji: "🔮", label: "Bola de cristal", group: "juego", img: fluentEmojiUrl("Crystal ball") },
  { emoji: "🎲", label: "Dado", group: "juego", img: fluentEmojiUrl("Game die") },
  { emoji: "🧩", label: "Rompecabezas", group: "juego", img: fluentEmojiUrl("Puzzle piece") },
  { emoji: "💎", label: "Diamante", group: "juego", img: fluentEmojiUrl("Gem stone") },
  { emoji: "💣", label: "Bomba", group: "juego", img: fluentEmojiUrl("Bomb") },
  { emoji: "💥", label: "Explosión", group: "juego", img: fluentEmojiUrl("Collision") },
  { emoji: "☄️", label: "Cometa", group: "juego", img: fluentEmojiUrl("Comet") },
  { emoji: "🪐", label: "Planeta", group: "juego", img: fluentEmojiUrl("Ringed planet") },
  { emoji: "🛸", label: "Ovni", group: "juego", img: fluentEmojiUrl("Flying saucer") },
  { emoji: "🌋", label: "Volcán", group: "juego", img: fluentEmojiUrl("Volcano") },
  { emoji: "🦾", label: "Brazo biónico", group: "juego", img: fluentEmojiUrl("Mechanical arm") },
  { emoji: "🏎️", label: "Carro de carreras", group: "juego", img: fluentEmojiUrl("Racing car") },
  { emoji: "🏍️", label: "Moto", group: "juego", img: fluentEmojiUrl("Motorcycle") },
  // Personajes
  { emoji: "🤖", label: "Robot", group: "personajes", img: fluentEmojiUrl("Robot") },
  { emoji: "👽", label: "Alien", group: "personajes", img: fluentEmojiUrl("Alien") },
  { emoji: "🥷", label: "Ninja", group: "personajes", img: fluentEmojiUrl("Ninja", "Default") },
  { emoji: "👻", label: "Fantasma", group: "personajes", img: fluentEmojiUrl("Ghost") },
  { emoji: "💀", label: "Calavera", group: "personajes", img: fluentEmojiUrl("Skull") },
  { emoji: "🤡", label: "Payaso", group: "personajes", img: fluentEmojiUrl("Clown face") },
  { emoji: "🧟", label: "Zombi", group: "personajes", img: fluentEmojiUrl("Person zombie") },
  { emoji: "🧛", label: "Vampiro", group: "personajes", img: fluentEmojiUrl("Person vampire", "Default") },
  { emoji: "🦸", label: "Superhéroe", group: "personajes", img: fluentEmojiUrl("Person superhero", "Default") },
  { emoji: "🦹", label: "Villano", group: "personajes", img: fluentEmojiUrl("Person supervillain", "Default") },
  { emoji: "🧞", label: "Genio", group: "personajes", img: fluentEmojiUrl("Person genie") },
  { emoji: "🧚", label: "Hada", group: "personajes", img: fluentEmojiUrl("Person fairy", "Default") },
  { emoji: "👺", label: "Tengu", group: "personajes", img: fluentEmojiUrl("Goblin") },
  { emoji: "👹", label: "Ogro", group: "personajes", img: fluentEmojiUrl("Ogre") },
  { emoji: "🃏", label: "Comodín", group: "personajes", img: fluentEmojiUrl("Joker") },
  { emoji: "🗿", label: "Moái", group: "personajes", img: fluentEmojiUrl("Moai") },
  { emoji: "🎃", label: "Calabaza", group: "personajes", img: fluentEmojiUrl("Jack-o-lantern") },
  { emoji: "🧑‍🚀", label: "Astronauta", group: "personajes", img: fluentEmojiUrl("Astronaut", "Default") },
  // Caras
  { emoji: "😈", label: "Diablillo", group: "caras", img: fluentEmojiUrl("Smiling face with horns") },
  { emoji: "😎", label: "Crack", group: "caras", img: fluentEmojiUrl("Smiling face with sunglasses") },
  { emoji: "🤠", label: "Vaquero", group: "caras", img: fluentEmojiUrl("Cowboy hat face") },
  { emoji: "🤯", label: "Mente explotada", group: "caras", img: fluentEmojiUrl("Exploding head") },
  { emoji: "🤓", label: "Nerd", group: "caras", img: fluentEmojiUrl("Nerd face") },
  { emoji: "🧐", label: "Analista", group: "caras", img: fluentEmojiUrl("Face with monocle") },
  { emoji: "🤩", label: "Estrellado", group: "caras", img: fluentEmojiUrl("Star-struck") },
  { emoji: "🤪", label: "Loco", group: "caras", img: fluentEmojiUrl("Zany face") },
  { emoji: "🥳", label: "Fiestero", group: "caras", img: fluentEmojiUrl("Partying face") },
  { emoji: "🥸", label: "Disfrazado", group: "caras", img: fluentEmojiUrl("Disguised face") },
  { emoji: "🥵", label: "Acalorado", group: "caras", img: fluentEmojiUrl("Hot face") },
  { emoji: "🥶", label: "Congelado", group: "caras", img: fluentEmojiUrl("Cold face") },
  { emoji: "🤑", label: "Billetero", group: "caras", img: fluentEmojiUrl("Money-mouth face") },
  { emoji: "😇", label: "Angelito", group: "caras", img: fluentEmojiUrl("Smiling face with halo") },
  // Animales
  { emoji: "🐐", label: "GOAT", group: "animales", img: fluentEmojiUrl("Goat") },
  { emoji: "🦁", label: "León", group: "animales", img: fluentEmojiUrl("Lion") },
  { emoji: "🐺", label: "Lobo", group: "animales", img: fluentEmojiUrl("Wolf") },
  { emoji: "🦊", label: "Zorro", group: "animales", img: fluentEmojiUrl("Fox") },
  { emoji: "🐼", label: "Panda", group: "animales", img: fluentEmojiUrl("Panda") },
  { emoji: "🦅", label: "Águila", group: "animales", img: fluentEmojiUrl("Eagle") },
  { emoji: "🦈", label: "Tiburón", group: "animales", img: fluentEmojiUrl("Shark") },
  { emoji: "🐙", label: "Pulpo", group: "animales", img: fluentEmojiUrl("Octopus") },
  { emoji: "🐉", label: "Dragón", group: "animales", img: fluentEmojiUrl("Dragon") },
  { emoji: "🦖", label: "T-Rex", group: "animales", img: `${FLUENT_BASE}/T-rex/3D/t-rex_3d.png` },
  { emoji: "🦄", label: "Unicornio", group: "animales", img: fluentEmojiUrl("Unicorn") },
  { emoji: "🐯", label: "Tigre", group: "animales", img: fluentEmojiUrl("Tiger face") },
  { emoji: "🦍", label: "Gorila", group: "animales", img: fluentEmojiUrl("Gorilla") },
  { emoji: "🐻", label: "Oso", group: "animales", img: fluentEmojiUrl("Bear") },
  { emoji: "🐻‍❄️", label: "Oso polar", group: "animales", img: fluentEmojiUrl("Polar bear") },
  { emoji: "🐵", label: "Mono", group: "animales", img: fluentEmojiUrl("Monkey face") },
  { emoji: "🐱", label: "Gato", group: "animales", img: fluentEmojiUrl("Cat face") },
  { emoji: "🐶", label: "Perro", group: "animales", img: fluentEmojiUrl("Dog face") },
  { emoji: "🐸", label: "Rana", group: "animales", img: fluentEmojiUrl("Frog") },
  { emoji: "🦉", label: "Búho", group: "animales", img: fluentEmojiUrl("Owl") },
  { emoji: "🐧", label: "Pingüino", group: "animales", img: fluentEmojiUrl("Penguin") },
  { emoji: "🐨", label: "Koala", group: "animales", img: fluentEmojiUrl("Koala") },
  { emoji: "🦏", label: "Rinoceronte", group: "animales", img: fluentEmojiUrl("Rhinoceros") },
  { emoji: "🐊", label: "Cocodrilo", group: "animales", img: fluentEmojiUrl("Crocodile") },
  { emoji: "🦂", label: "Escorpión", group: "animales", img: fluentEmojiUrl("Scorpion") },
  { emoji: "🕷️", label: "Araña", group: "animales", img: fluentEmojiUrl("Spider") },
  { emoji: "🦇", label: "Murciélago", group: "animales", img: fluentEmojiUrl("Bat") },
  { emoji: "🦜", label: "Loro", group: "animales", img: fluentEmojiUrl("Parrot") },
  { emoji: "🐂", label: "Toro", group: "animales", img: fluentEmojiUrl("Ox") },
  { emoji: "🐍", label: "Serpiente", group: "animales", img: fluentEmojiUrl("Snake") },
  { emoji: "🐢", label: "Tortuga", group: "animales", img: fluentEmojiUrl("Turtle") },
  { emoji: "🐬", label: "Delfín", group: "animales", img: fluentEmojiUrl("Dolphin") },
  { emoji: "🦣", label: "Mamut", group: "animales", img: fluentEmojiUrl("Mammoth") },
  // Fútbol y deporte
  { emoji: "⚽", label: "Balón", group: "deporte", img: fluentEmojiUrl("Soccer ball") },
  { emoji: "🥅", label: "Portería", group: "deporte", img: fluentEmojiUrl("Goal net") },
  { emoji: "🏆", label: "Copa", group: "deporte", img: fluentEmojiUrl("Trophy") },
  { emoji: "🥇", label: "Medalla de oro", group: "deporte", img: fluentEmojiUrl("1st place medal") },
  { emoji: "🏀", label: "Baloncesto", group: "deporte", img: fluentEmojiUrl("Basketball") },
  { emoji: "🥊", label: "Guante de boxeo", group: "deporte", img: fluentEmojiUrl("Boxing glove") },
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
