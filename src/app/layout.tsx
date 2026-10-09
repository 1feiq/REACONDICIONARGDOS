import type { Metadata } from 'next';
import Link from 'next/link';
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
    'Vendé tu equipo roto o encontrá técnicos para repararlo. Conectamos personas de Rosario, sin comisiones por operación.',
  icons: { icon: '/favicon.svg' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <a className="skip" href="#main">
          Saltar al contenido
        </a>
        <Header />
        {!configured() && (
          <div className="preview-notice">
            Vista previa · Los equipos y valores de ejemplo no son ofertas reales. Registros y pagos
            aún no están habilitados.
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
              Hecho para conectar Rosario.
            </p>
            <div>
              <Link href="/equipos">Explorar</Link>
              <Link href="/suscripcion">Para técnicos</Link>
              <Link href="/terminos">Cómo funciona y condiciones</Link>
            </div>
            <span>
              Solo conectamos personas.
              <br />
              Sin comisiones ni envíos.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
