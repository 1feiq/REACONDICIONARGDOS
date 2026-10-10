import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container section">
      <div className="empty">
        <h1>Este equipo ya no está disponible.</h1>
        <p>Podés buscar otras publicaciones de Argentina.</p>
        <Link className="button" href="/equipos">
          Explorar equipos
        </Link>
      </div>
    </div>
  );
}
