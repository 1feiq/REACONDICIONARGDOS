import Link from 'next/link';
import { db } from '@/lib/supabase/server';
import { AlertPreferences, ReadAlerts } from './alert-preferences';
export async function ListingAlerts({ userId }: { userId: string }) {
  const client = (await db())!;
  const { data: preference, error } = await client
    .from('listing_alerts')
    .select('category,enabled,seen_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error)
    return (
      <div className="notice">No pudimos cargar las alertas. Intentá nuevamente más tarde.</div>
    );
  const cutoff = new Date().toISOString();
  let matches: { id: string; brand: string; model: string }[] = [];
  let loadFailed = false;
  if (preference?.enabled) {
    let query = client
      .from('devices')
      .select('id,brand,model')
      .eq('status', 'publicado')
      .gt('published_at', preference.seen_at)
      .lte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(21);
    if (preference.category !== 'todas') query = query.eq('category', preference.category);
    const result = await query;
    matches = result.data ?? [];
    loadFailed = Boolean(result.error);
  }
  return (
    <section className="panel" style={{ marginBottom: 30 }}>
      <h2>Alertas de publicaciones</h2>
      <p>
        Guardá una categoría y revisá las novedades gratis en tu cuenta.
      </p>
      <AlertPreferences
        category={preference?.category ?? 'todas'}
        enabled={preference?.enabled ?? false}
      />
      {loadFailed ? (
        <p role="alert">No pudimos cargar las novedades.</p>
      ) : (
        preference?.enabled && (
          <>
            <h3>
              {matches.length
                ? 'Nuevos equipos para vos'
                : 'Todavía no hay novedades desde tu última revisión.'}
            </h3>
            <ul>
              {matches.slice(0, 20).map((d) => (
                <li key={d.id}>
                  <Link href={`/equipos/${d.id}`}>
                    {d.brand} {d.model}
                  </Link>
                </li>
              ))}
            </ul>
            {matches.length > 20 && (
              <p>
                Mostramos las 20 novedades más recientes. Marcar todas como leídas también incluye
                las anteriores.
              </p>
            )}
            {matches.length > 0 && <ReadAlerts cutoff={cutoff} />}
          </>
        )
      )}
    </section>
  );
}
