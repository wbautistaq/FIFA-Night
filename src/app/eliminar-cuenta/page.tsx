import Link from "next/link";
import { CheckCircle, Trash } from "@phosphor-icons/react/dist/ssr";

export const metadata = { title: "Eliminar cuenta", description: "Cómo eliminar tu cuenta de FIFA Night y qué datos se borran." };

/** Página pública (sin iniciar sesión) que Google Play exige para pedir el borrado de la cuenta. */
export default async function DeleteAccountInfo({ searchParams }: { searchParams: Promise<{ hecho?: string }> }) {
  const { hecho } = await searchParams;
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <main id="main" className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      {hecho ? (
        <div role="status" className="card flex items-start gap-3 border-neon/50">
          <CheckCircle size={28} weight="fill" className="shrink-0 text-neon" aria-hidden />
          <p>Tu cuenta y tus datos personales fueron eliminados. Gracias por jugar en FIFA Night.</p>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <span className="icon-tile h-12 w-12 rounded-xl"><Trash size={26} weight="duotone" aria-hidden /></span>
        <h1 className="text-3xl uppercase">Eliminar tu cuenta</h1>
      </div>

      <section className="card space-y-2">
        <h2 className="text-lg uppercase">Desde la app</h2>
        <ol className="list-decimal space-y-1 pl-5 text-white/85">
          <li>Inicia sesión en FIFA Night.</li>
          <li>Abre <b>Perfil</b>.</li>
          <li>Al final, toca <b>Eliminar mi cuenta</b>, revisa qué pasará con tus torneos y escribe ELIMINAR.</li>
        </ol>
        <Link href="/perfil" className="btn-primary mt-2 w-full">Ir a mi perfil</Link>
      </section>

      <section className="card space-y-2 text-white/85">
        <h2 className="text-lg uppercase">Qué se borra</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tu cuenta, correo, contraseña y perfil (nombre, apodo, foto, plataforma e ID de jugador).</li>
          <li>Tus publicaciones del muro y las fotos que subiste.</li>
          <li>Tus avisos, suscripciones a notificaciones y personas bloqueadas.</li>
          <li>Los torneos que organizas pasan a un coorganizador con cuenta; si no hay, se borran.</li>
        </ul>
        <h2 className="pt-2 text-lg uppercase">Qué se conserva</h2>
        <p>En torneos de otras personas tus partidos y resultados se mantienen para no dañar sus tablas, pero aparecen como «Jugador eliminado», sin tu nombre, foto ni ID de jugador. Los reportes de moderación se conservan sin datos de tu cuenta.</p>
        <p>El borrado es inmediato y no se puede deshacer.</p>
      </section>

      {support ? (
        <section className="card space-y-2 text-white/85">
          <h2 className="text-lg uppercase">¿No puedes entrar?</h2>
          <p>Escríbenos desde el correo de tu cuenta a <a className="font-semibold text-neon underline" href={`mailto:${support}?subject=Eliminar%20mi%20cuenta`}>{support}</a> y la eliminamos por ti en un máximo de 30 días.</p>
        </section>
      ) : null}
    </main>
  );
}
