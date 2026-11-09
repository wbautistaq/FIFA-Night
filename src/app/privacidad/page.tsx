import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { PRIVACY_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata = { title: "Política de privacidad", description: "Qué datos recoge Copa del Parche, para qué los usa y cómo ejercer tus derechos." };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-2 text-white/85">
      <h2 className="text-lg uppercase text-white">{title}</h2>
      {children}
    </section>
  );
}

const mail = <a className="font-semibold text-neon underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

/** Política de privacidad pública (requisito de Google Play y de la Ley 1581 de 2012 de Colombia). */
export default function PrivacyPolicy() {
  return (
    <main id="main" className="mx-auto max-w-2xl space-y-4 px-4 py-8 leading-relaxed">
      <div className="flex items-center gap-3">
        <span className="icon-tile h-12 w-12 shrink-0 rounded-xl"><ShieldCheck size={26} weight="duotone" aria-hidden /></span>
        <div>
          <h1 className="text-3xl uppercase">Política de privacidad</h1>
          <p className="text-sm text-white/60">Última actualización: {PRIVACY_UPDATED}</p>
        </div>
      </div>

      <p className="text-white/85">
        Copa del Parche es una aplicación para organizar torneos de fútbol en consola entre amigos. Aquí explicamos qué datos
        recogemos, para qué los usamos, con quién los compartimos y cómo puedes consultarlos, corregirlos o borrarlos.
        Tratamos los datos conforme a la Ley 1581 de 2012 de Colombia y sus decretos reglamentarios.
      </p>

      <Section title="1. Responsable y contacto">
        <p>El responsable del tratamiento es Copa del Parche, con domicilio en Bogotá, Colombia. Para cualquier consulta sobre tus datos escríbenos a {mail}.</p>
      </Section>

      <Section title="2. Qué datos recogemos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Cuenta:</b> correo electrónico y contraseña (la guarda cifrada nuestro proveedor de autenticación; nosotros no podemos verla). Si eres parte del equipo de la plataforma, también la configuración de tu verificación en dos pasos.</li>
          <li><b>Perfil:</b> nombre, apodo, foto o avatar, color, plataforma de juego e ID de jugador, si decides darlos.</li>
          <li><b>Actividad en torneos:</b> torneos que creas o en los que participas, equipos asignados, resultados, estadísticas, logros, predicciones, votos de MVP, fotos de marcadores y publicaciones, fotos y reacciones del muro.</li>
          <li><b>Invitados sin cuenta:</b> el nombre con el que el organizador los agrega o con el que se unen, y un identificador guardado en una cookie de su navegador para reconocerlos en ese torneo.</li>
          <li><b>Moderación:</b> los reportes que envías o que otros hacen sobre contenido tuyo (con una copia del contenido reportado) y la lista de personas que bloqueaste.</li>
          <li><b>Notificaciones:</b> si las activas, la suscripción que entrega tu navegador para enviarte avisos.</li>
          <li><b>Datos técnicos:</b> sesiones abiertas (tipo de dispositivo y navegador, fechas de inicio y último uso). Nuestro proveedor de autenticación registra además la dirección IP para proteger las cuentas.</li>
        </ul>
        <p>No pedimos datos sensibles (como salud, origen étnico, religión u opiniones políticas), ni datos de pago, ni tu ubicación.</p>
      </Section>

      <Section title="3. Para qué los usamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Crear y mantener tu cuenta e iniciar sesión.</li>
          <li>Organizar torneos: sorteos, calendario, resultados, tablas, estadísticas y el muro.</li>
          <li>Enviarte avisos sobre tus partidos y torneos, si los activas.</li>
          <li>Proteger la plataforma: detectar abusos, atender reportes y bloquear cuentas que incumplan las normas.</li>
          <li>Responder tus solicitudes de soporte.</li>
        </ul>
        <p>No vendemos tus datos, no mostramos publicidad y no usamos herramientas de analítica ni de seguimiento de terceros.</p>
      </Section>

      <Section title="4. Quién puede ver tu información">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b>Participantes de tus torneos</b> y quienes tengan el enlace o el código de un torneo: tu nombre o apodo, avatar, plataforma, ID de jugador, equipos, partidos, resultados, estadísticas y publicaciones de ese torneo. Tu correo nunca se muestra a otros jugadores.</li>
          <li><b>Equipo de la plataforma</b> (administradores y moderadores): accede a lo necesario para la seguridad y la moderación. Los moderadores no ven correos ni sesiones.</li>
          <li><b>Proveedores que nos prestan el servicio</b>, solo para hacerlo funcionar:
            <ul className="mt-1 list-[circle] space-y-1 pl-5">
              <li>Supabase: base de datos, autenticación y almacenamiento de archivos.</li>
              <li>Vercel: alojamiento de la aplicación.</li>
              <li>jsDelivr: entrega las imágenes de los avatares gamer (recibe tu dirección IP al cargarlas).</li>
              <li>Los servicios de notificaciones de tu navegador o sistema (por ejemplo, Google, Apple o Mozilla), si activas los avisos.</li>
            </ul>
          </li>
          <li><b>Autoridades</b>, solo cuando la ley lo exija.</li>
        </ul>
        <p>Algunos de estos proveedores tienen servidores fuera de Colombia, por lo que tus datos pueden almacenarse en otros países con medidas de protección adecuadas. Al usar la app autorizas esta transferencia.</p>
      </Section>

      <Section title="5. Cookies y almacenamiento en tu dispositivo">
        <p>Usamos solo cookies necesarias: la de tu sesión, la que identifica a los invitados en un torneo y la que recuerda que ya viste la bienvenida. También guardamos en tu dispositivo algunas preferencias, como avisos ya vistos. No usamos cookies de publicidad.</p>
      </Section>

      <Section title="6. Cuánto tiempo los guardamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Mientras tu cuenta exista. Puedes borrarla cuando quieras desde Perfil (<Link href="/eliminar-cuenta" className="font-semibold text-neon underline">ver cómo</Link>).</li>
          <li>Al eliminarla se borran tu perfil, tus fotos, tus publicaciones, tus avisos y tus bloqueos. En torneos de otras personas tus partidos se conservan como «Jugador eliminado», sin tu nombre ni tu foto.</li>
          <li>Los reportes de moderación se conservan sin datos de tu cuenta para prevenir abusos.</li>
          <li>Las copias de seguridad de nuestro proveedor pueden conservar información hasta 30 días antes de borrarse por completo.</li>
        </ul>
      </Section>

      <Section title="7. Seguridad">
        <p>Toda la comunicación viaja cifrada (HTTPS). Cada persona solo puede leer y modificar lo que le corresponde según reglas en la base de datos, y el equipo de la plataforma debe usar verificación en dos pasos. Ningún sistema es infalible; si detectamos un incidente que afecte tus datos te avisaremos.</p>
      </Section>

      <Section title="8. Tus derechos">
        <p>Puedes conocer, actualizar y corregir tus datos, pedir que los borremos, revocar tu autorización y solicitar prueba de ella. Gran parte lo haces tú mismo en Perfil. Para lo demás escríbenos a {mail} desde el correo de tu cuenta.</p>
        <p>Respondemos consultas en un máximo de 10 días hábiles y reclamos en un máximo de 15 días hábiles. Si no quedas satisfecho, puedes acudir a la Superintendencia de Industria y Comercio (SIC).</p>
      </Section>

      <Section title="9. Menores de edad">
        <p>Copa del Parche no está dirigida a menores de 13 años y no recogemos a sabiendas sus datos. Los menores de 18 deben usarla con autorización de su padre, madre o tutor. Si crees que un menor de 13 años nos dio datos, escríbenos y los borraremos.</p>
      </Section>

      <Section title="10. Cambios a esta política">
        <p>Si cambiamos esta política actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos dentro de la app.</p>
      </Section>
    </main>
  );
}
