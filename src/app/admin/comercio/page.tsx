import Link from 'next/link';
import { requireAdmin } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { CommerceForm } from '@/components/commerce-form';
import { money } from '@/lib/config';
import { orderLabels, verificationLabels } from '@/lib/commerce';
export default async function CommerceAdmin() {
  await requireAdmin();
  const client = (await db())!;
  const [slots, subs, payments, orders, disputes, users, reports, audit, requests] =
    await Promise.all([
      client.from('founder_slots').select('*').order('slot'),
      client.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(100),
      client
        .from('subscription_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      client
        .from('protected_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      client.from('disputes').select('*').neq('status', 'resolved').limit(100),
      client
        .from('users')
        .select('id,display_name,verification_status')
        .order('created_at', { ascending: false })
        .limit(100),
      client.from('listing_reports').select('*').eq('status', 'open').limit(100),
      client.from('admin_audit').select('*').order('created_at', { ascending: false }).limit(100),
      client
        .from('financial_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
  return (
    <div className="container page-shell">
      <h1>Suscripciones y operaciones</h1>
      <p>
        Consultas limitadas a los últimos 100 registros por sección. Los cupos se muestran
        completos. No se ejecutan transferencias desde este panel.
      </p>
      <h2>Cupos fundadores reales</h2>
      {slots.error ? (
        <p>Migración pendiente o datos no disponibles.</p>
      ) : (
        <div className="form-grid">
          {slots.data?.map((s) => (
            <div className="notice" key={s.slot}>
              #{s.slot} · {s.user_id ?? 'Disponible'} {s.lost_at ? '· Beneficio perdido' : ''}
            </div>
          ))}
        </div>
      )}
      <h2>Suscripciones</h2>
      {subs.data?.map((s) => (
        <p key={s.id}>
          {s.user_id} · {s.status} · {money(Number(s.price_amount))} · {s.billed_cycles ?? 0} ciclos
        </p>
      ))}
      <h2>Pagos y renovaciones</h2>
      {payments.data?.map((p) => (
        <p key={p.id}>
          {p.external_payment_id} · {money(Number(p.amount))} · {p.status} · ciclo{' '}
          {p.cycle_number ?? 'Anterior'}
        </p>
      ))}
      <h2>Operaciones, comisiones y evidencias</h2>
      {orders.data?.map((o) => (
        <p key={o.id}>
          <Link href={'/operaciones/' + o.id}>
            {o.id} · {orderLabels[o.status]}
          </Link>{' '}
          · Servicio: {money(Number(o.fee_amount))}
        </p>
      ))}
      <h2>Reclamos</h2>
      {disputes.data?.map((d) => (
        <section className="panel" key={d.id}>
          <Link href={'/operaciones/' + d.order_id}>Abrir expediente y evidencias</Link>
          <p>
            {d.reason}: {d.description}
          </p>
          <CommerceForm
            id={d.order_id}
            action="admin:review_dispute"
            label="Iniciar revisión"
            text
          />
          <CommerceForm
            id={d.order_id}
            action="admin:request_return"
            label="Solicitar devolución con seguimiento"
            text
          />
          <CommerceForm
            id={d.order_id}
            action="admin:request_refund"
            label="Registrar decisión de reembolso"
            text
          />
          <CommerceForm
            id={d.order_id}
            action="admin:resolve_release"
            label="Resolver y solicitar liberación"
            text
          />
        </section>
      ))}
      <h2>Solicitudes financieras</h2>
      {requests.data?.map((r) => (
        <p key={r.id}>
          {r.order_id} · {r.action} · {r.status}
        </p>
      ))}
      <h2>Verificaciones y cuentas</h2>
      <p>
        Marcar una identidad como verificada requiere confirmación del proveedor, aún no integrado.
        No se aceptan documentos por este panel.
      </p>
      {users.data?.map((u) => (
        <details key={u.id}>
          <summary>
            {u.display_name} · {verificationLabels[u.verification_status]}
          </summary>
          <CommerceForm
            id={u.id}
            action="admin:reject_verification"
            label="Rechazar solicitud con fundamento"
            text
          />
          <CommerceForm
            id={u.id}
            action="admin:suspend"
            label="Suspender cuenta con fundamento"
            text
          />
        </details>
      ))}
      <h2>Publicaciones reportadas</h2>
      {reports.data?.map((r) => (
        <section className="panel" key={r.id}>
          <Link href={'/equipos/' + r.device_id}>Ver publicación</Link>
          <p>{r.reason}</p>
          <CommerceForm
            id={r.id}
            action="admin:review_report"
            label="Registrar revisión del reporte"
            text
          />
        </section>
      ))}
      <h2>Auditoría administrativa</h2>
      {audit.data?.map((a) => (
        <p key={a.id}>
          {new Date(a.created_at).toLocaleString('es-AR')} · {a.actor_id} · {a.action} · {a.reason}
        </p>
      ))}
    </div>
  );
}
