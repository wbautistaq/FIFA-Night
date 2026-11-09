import {
  Anton, Archivo, Archivo_Black, Barlow_Condensed, Chakra_Petch, Inter, Pixelify_Sans, Russo_One, Silkscreen, Sora, Space_Grotesk, Teko, Unbounded,
} from "next/font/google";

// Cada tema elige su pareja de fuentes en globals.css. Solo se precargan las del tema gratuito;
// las demás se descargan únicamente si el tema activo las usa.
const teko = Teko({ subsets: ["latin"], display: "swap", variable: "--ff-teko" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--ff-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--ff-space-grotesk", preload: false });
const barlow = Barlow_Condensed({ weight: ["600", "700", "800"], subsets: ["latin"], display: "swap", variable: "--ff-barlow", preload: false });
const unbounded = Unbounded({ subsets: ["latin"], display: "swap", variable: "--ff-unbounded", preload: false });
const archivoBlack = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap", variable: "--ff-archivo-black", preload: false });
const archivo = Archivo({ subsets: ["latin"], display: "swap", variable: "--ff-archivo", preload: false });
const sora = Sora({ subsets: ["latin"], display: "swap", variable: "--ff-sora", preload: false });
const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap", variable: "--ff-anton", preload: false });
const silkscreen = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], display: "swap", variable: "--ff-silkscreen", preload: false });
const pixelify = Pixelify_Sans({ subsets: ["latin"], display: "swap", variable: "--ff-pixelify", preload: false });
const russo = Russo_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--ff-russo", preload: false });
const chakra = Chakra_Petch({ weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap", variable: "--ff-chakra", preload: false });

export const fontVariables = [teko, inter, spaceGrotesk, barlow, unbounded, archivoBlack, archivo, sora, anton, silkscreen, pixelify, russo, chakra]
  .map((f) => f.variable)
  .join(" ");
