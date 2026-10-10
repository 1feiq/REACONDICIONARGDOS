import { requireAdmin } from '@/lib/data';
import Link from 'next/link';
import { db } from '@/lib/supabase/server';
import { StatusForm } from '@/components/status-form';
import { ConfirmContact } from '@/components/confirm-contact';
import { PhotoCleanup } from '@/components/photo-cleanup';
export default async function Admin() {
  await requireAdmin();
  const client = (await db())!;
  const { data, error } = await client
    .from('devices')
    .select('id,brand,model,status,source,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('No se pudieron cargar las publicaciones.');
  return (
    <div className="container page-shell">
      <div className="page-header split">
        <div>
          <span className="eyebrow">Administración</span>
          <h1>Publicaciones de Argentina.</h1>
          <p>Cargá oportunidades autorizadas y mantené su disponibilidad actualizada.</p>
        </div>
        <div className="actions">
          <Link className="button" href="/admin/publicaciones/nueva">
            Cargar publicación
          </Link>
          <Link className="button secondary" href="/admin/cotizador">
            Cotizador
          </Link>
        </div>
      </div>
      <div className="admin-list">
        {data?.map((d) => (
          <div key={d.id} className="admin-row">
            <div>
              <Link href={`/equipos/${d.id}`}>
                <h3>
                  {d.brand} {d.model}
                </h3>
              </Link>
              <small>
                {d.status} · {d.source === 'admin' ? 'Carga manual' : 'Usuario'}
              </small>
            </div>
            {d.status === 'borrador' ? (
              <ConfirmContact id={d.id} />
            ) : (
              <StatusForm id={d.id} status={d.status} />
            )}
          </div>
        ))}
      </div>
      {!data?.length && (
        <div className="empty">
          <h3>Listo para tu primera publicación.</h3>
          <p>No se cargaron equipos ficticios en tu base.</p>
          <Link href="/admin/publicaciones/nueva" className="button">
            Cargar un equipo autorizado
          </Link>
        </div>
      )}
      <Link className="button secondary" href="/admin/moderacion">
        Moderación, usuarios y publicidad
      </Link>
      <PhotoCleanup />
    </div>
  );
}
