import type { Metadata } from 'next';
import Link from 'next/link';
import { Analytics } from '@/components/analytics';
import { Header } from '@/components/header';
import { configured } from '@/lib/config';
import './globals.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL('https://reacondicionargdos.com'),
  title: {
    default: 'reacondicionargdos · Tu equipo tiene otra oportunidad',
    template: '%s · reacondicionargdos',
  },
  description:
    'Vendé tu equipo roto o encontrá técnicos para repararlo. Marketplace gratuito para toda Argentina, sin comisiones por operación.',
  icons: { icon: '/favicon.svg' },
  verification:{google:process.env.GOOGLE_SITE_VERIFICATION},
  openGraph:{type:'website',siteName:'REACONDICIONARGDOS',locale:'es_AR'},
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <a className="skip" href="#main">
          Saltar al contenido
        </a>
        <Header />
        <Analytics />
        {!configured() && (
          <div className="preview-notice">
            El servicio de publicaciones todavía no está conectado. No se muestran equipos ficticios.
          </div>
        )}
        <main id="main">{children}</main>
        <footer>
          <div className="container footer">
            <Link className="brand" href="/">
              reacondicionargdos
            </Link>
            <p>
              Más vida para tu tecnología.
              <br />
              Hecho para conectar Argentina.
            </p>
            <div>
              <Link href="/equipos">Explorar</Link>
              <Link href="/guias">Guías para comprar y reparar</Link>
              <Link href="/privacidad">Privacidad</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/contacto">Contacto</Link>
              <Link href="/ayuda">Ayuda</Link>
              <Link href="/terminos">Cómo funciona y condiciones</Link>
            </div>
            <span>
              Solo conectamos personas.
              <br />
              Operaciones directas sin cobertura.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
