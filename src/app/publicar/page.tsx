import Link from 'next/link';
import { getProfile } from '@/lib/data';
import { DeviceForm } from '@/components/device-form';
export default async function Publish({
  searchParams,
}: {
  searchParams: Promise<{ modelo?: string; falla?: string }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);
  return (
    <div className="container narrow page-shell">
      <div className="page-header">
        <span className="eyebrow">Publicar es 100% gratis</span>
        <h1>Dale otra oportunidad.</h1>
        <p>Contá qué le pasó a tu equipo y conectá con técnicos de Argentina.</p>
      </div>
      {!profile ? (
        <div className="panel">
          <h3>Primero, ingresá a tu cuenta.</h3>
          <p>Así podés administrar tu publicación y cerrarla cuando encuentres una solución.</p>
          <Link className="button" href="/ingresar">
            Ingresar o crear cuenta
          </Link>
        </div>
      ) : (
        <div className="panel">
          <DeviceForm
            initialModel={params.modelo ?? ''}
            initialFault={params.falla ?? 'pantalla_rota'}
          />
        </div>
      )}
    </div>
  );
}
