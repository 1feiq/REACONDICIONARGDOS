import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';
import { StatusForm } from '@/components/status-form';
export default async function Account() {
  const profile = await getProfile();
  if (!profile) redirect('/ingresar');
  const client = (await db())!;
  const { data: devices } = await client
    .from('devices')
    .select('id,brand,model,status')
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: false });
  return (
    <div className="container page-shell">
      <div className="page-header split">
        <div>
          <span className="eyebrow">Tu espacio en reacondicionargdos</span>
          <h1>Hola, {profile.display_name}.</h1>
          <p>{profile.email} · Rosario</p>
        </div>
        <form action={signOut}>
          <button className="button secondary">Cerrar sesión</button>
        </form>
      </div>
      <div className="actions" style={{ marginBottom: 30 }}>
        <Link className="button" href="/publicar">
          Publicar equipo
        </Link>
        <Link className="button secondary" href="/suscripcion">
          Mi suscripción
        </Link>
        {profile.role === 'admin' && (
          <Link className="button secondary" href="/admin">
            Administración
          </Link>
        )}
      </div>
      <h2>Mis publicaciones</h2>
      <div className="admin-list">
        {devices?.map((d) => (
          <div key={d.id} className="admin-row">
            <div>
              <Link href={`/equipos/${d.id}`}>
                <h3>
                  {d.brand} {d.model}
                </h3>
              </Link>
              <small>{d.status}</small>
            </div>
            <StatusForm id={d.id} status={d.status} />
          </div>
        ))}
      </div>
      {!devices?.length && (
        <div className="empty">
          <h3>Todavía no publicaste equipos.</h3>
          <p>Tu primera publicación es gratis.</p>
        </div>
      )}
    </div>
  );
}
