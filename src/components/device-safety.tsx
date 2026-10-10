import Link from 'next/link';
import { db } from '@/lib/supabase/server';
import { MarketForm } from './market-form';
import { money } from '@/lib/config';
import { verificationLabels } from '@/lib/commerce';
export async function DeviceSafety({ id, owner }: { id: string; owner?: string | null }) {
  const client = await db();
  if (!client) return null;
  const [{ data: spec }, { data: checks }, rep] = await Promise.all([
    client.from('device_specs').select('*').eq('device_id', id).maybeSingle(),
    client.from('device_checks').select('source,result,checked_at').eq('device_id', id),
    owner ? client.rpc('public_reputation', { p_user: owner }) : Promise.resolve({ data: null }),
  ]);
  return (
    <section className="panel" style={{ marginBlock: 24 }}>
      <h2>Información y seguridad</h2>
      {spec ? (
        <>
          <span className="badge">Declarado por el vendedor</span>
          <dl>
            {Object.entries({
              Almacenamiento: spec.storage_capacity,
              'Estado físico': spec.physical_condition,
              Enciende: spec.power_on,
              Pantalla: spec.screen,
              Batería: spec.battery,
              Placa: spec.motherboard,
              Bloqueos: spec.activation_lock,
              'Reparaciones anteriores': spec.previous_repairs,
              Entrega: spec.delivery,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>
                  <strong>{k}</strong>
                </dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
          <p>
            {spec.asking_price ? money(Number(spec.asking_price)) : 'Sin precio solicitado'} ·{' '}
            {spec.accepts_offers ? 'Escucha ofertas' : 'Precio declarado'}
          </p>
        </>
      ) : (
        <p>Esta publicación todavía no tiene una ficha detallada de estado.</p>
      )}
      {checks?.length ? (
        checks.map((c) => (
          <p key={c.source + c.checked_at}>
            Consulta de {c.source}: {c.result} ·{' '}
            {new Date(c.checked_at).toLocaleDateString('es-AR')}. No garantiza propiedad legítima ni
            funcionamiento.
          </p>
        ))
      ) : (
        <p>Sin verificación externa de IMEI o funcionamiento.</p>
      )}
      {rep.data && (
        <p>
          {rep.data.name} · {verificationLabels[rep.data.verification]} · Cuenta desde{' '}
          {new Date(rep.data.joined).toLocaleDateString('es-AR')}. Ventas completadas:{' '}
          {rep.data.sales}; compras completadas: {rep.data.purchases}. Valoración como vendedor:{' '}
          {rep.data.seller_rating ?? 'Sin valoraciones verificadas'}; como comprador:{' '}
          {rep.data.buyer_rating ?? 'Sin valoraciones verificadas'}.
        </p>
      )}
      <p>
        Operación directa: acordás el pago y la entrega con la otra persona. No hay cobertura financiera de la plataforma.
      </p>
      <MarketForm id={id} action="report" label="Reportar publicación" text />
    </section>
  );
}
