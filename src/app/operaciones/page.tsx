import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { orderLabels } from '@/lib/commerce';
import { money } from '@/lib/config';
export default async function Orders() {
  const p = await getProfile();
  if (!p) redirect('/ingresar');
  const client = (await db())!;
  const { data, error } = await client
    .from('protected_orders')
    .select('id,buyer_id,status,item_amount,created_at')
    .or('buyer_id.eq.' + p.id + ',seller_id.eq.' + p.id)
    .order('created_at', { ascending: false })
    .limit(100);
  return (
    <div className="container page-shell">
      <h1>Compras, ventas y reclamos</h1>
      <p>Las operaciones directas fuera de este circuito no están protegidas.</p>
      {error ? (
        <div className="notice">El módulo aún no está disponible en esta base de datos.</div>
      ) : data?.length ? (
        data.map((o) => (
          <Link className="admin-row" href={'/operaciones/' + o.id} key={o.id}>
            <span>
              {o.buyer_id === p.id ? 'Compra' : 'Venta'} · {money(Number(o.item_amount))}
            </span>
            <strong>{orderLabels[o.status]}</strong>
          </Link>
        ))
      ) : (
        <section className="empty">
          <h2>Todavía no hay operaciones protegidas.</h2>
          <p>No generamos compras ni movimientos simulados.</p>
        </section>
      )}
      <Link className="button secondary" href="/compra-protegida">
        Cómo funcionará la protección
      </Link>
    </div>
  );
}
