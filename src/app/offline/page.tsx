import Link from "next/link";
import { WifiSlash } from "@phosphor-icons/react/dist/ssr";

export const metadata = { title: "Sin conexión" };

export default function Offline() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <WifiSlash size={56} weight="duotone" className="text-neon" aria-hidden />
      <h1 className="text-2xl uppercase">Sin conexión</h1>
      <p className="text-white/75">No pudimos conectar con Copa Parche. Revisa tu internet y vuelve a intentarlo.</p>
      <Link href="/" className="btn-primary mt-2">Reintentar</Link>
    </main>
  );
}
