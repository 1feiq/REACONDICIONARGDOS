import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDevice } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { money } from '@/lib/config';
export default async function Purchase({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await getDevice(id);
  if (!device) notFound();
  const client = await db();
  const result = client
    ? await client.from('device_specs').select('*').eq('device_id', id).maybeSingle()
    : null;
  const spec = result?.data;
  return (
    <div className="container page-shell">
      <h1>Revisar compra</h1>
      <section className="panel">
        <h2>
          {device.brand} {device.model}
        </h2>
        <p>{device.description}</p>
        <p>
          Precio solicitado:{' '}
          {spec?.asking_price ? money(Number(spec.asking_price)) : 'Sin precio informado'}
        </p>
        <p>
          Envío: pendiente de cotización. Servicio de protección: sin tarifa contratada. Total: no
          disponible.
        </p>
        <p>
          La descripción es una declaración del vendedor. No hay una verificación automática del
          equipo.
        </p>
        <div className="notice">
          Compra Protegida no está habilitada. Esta pantalla no reserva el equipo, no crea una
          compra y no realiza cargos.
        </div>
        <button className="button" disabled>
          Comprar con protección · Próximamente
        </button>
        <p>
          <Link href="/compra-protegida">Cobertura, exclusiones y reclamos</Link>
        </p>
      </section>
    </div>
  );
}
