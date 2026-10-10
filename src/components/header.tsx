import Link from 'next/link';
import { MapPin, Wrench } from 'lucide-react';
export function Header() {
  return (
    <header className="header">
      <div className="container nav">
        <Link className="brand" href="/" aria-label="reacondicionargdos, inicio">
          <span className="brand-mark">
            <Wrench size={23} />
          </span>
          reacondicionargdos
        </Link>
        <span className="location">
          <MapPin size={15} /> Argentina
        </span>
        <nav aria-label="Navegación principal">
          <Link href="/equipos">Explorar equipos</Link>
          <Link href="/guias">Guías</Link>
          <Link href="/mensajes">Mensajes</Link>
          <Link href="/cuenta" className="nav-account">
            Mi cuenta
          </Link>
          <Link className="button small" href="/publicar">
            Publicar gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}
