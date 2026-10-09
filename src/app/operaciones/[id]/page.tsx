import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/supabase/server';
import { getProfile } from '@/lib/data';
import { orderLabels, disputeReasons } from '@/lib/commerce';
import { CommerceForm, EvidenceForm } from '@/components/commerce-form';
import { money } from '@/lib/config';
export default async function Order({ params }: { params: Promise<{ id: string }> }) {
  const p = await getProfile();
  if (!p) redirect('/ingresar');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const client = (await db())!;
  const { data: o } = await client.from('protected_orders').select('*').eq('id', id).maybeSingle();
  if (!o) notFound();
  const [events, messages, evidence, dispute, requests, identifier] = await Promise.all([
    client.from('order_events').select('*').eq('order_id', id).order('created_at'),
    client.from('order_messages').select('*').eq('order_id', id).order('created_at'),
    client.from('order_evidence').select('*').eq('order_id', id),
    client.from('disputes').select('*').eq('order_id', id),
    client.from('financial_requests').select('*').eq('order_id', id),
    client.from('order_identifiers').select('kind,identifier').eq('order_id', id).maybeSingle(),
  ]);
  const signed = await Promise.all(
    (evidence.data ?? []).map(async (e) => ({
      ...e,
      url: (await client.storage.from('order-evidence').createSignedUrl(e.path, 60)).data
        ?.signedUrl,
    })),
  );
  const buyer = o.buyer_id === p.id,
    seller = o.seller_id === p.id;
  return (
    <div className="container page-shell">
      <h1>{orderLabels[o.status]}</h1>
      <p>Operación {id}</p>
      <section className="panel">
        <h2>Condiciones originales</h2>
        <p>
          {o.snapshot.device?.brand} {o.snapshot.device?.model}: {o.snapshot.device?.description}
        </p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(o.snapshot.specs, null, 2)}</pre>
        <p>
          Equipo {money(Number(o.item_amount))} + envío {money(Number(o.shipping_amount))} +
          servicio {money(Number(o.fee_amount))} ={' '}
          {money(Number(o.item_amount) + Number(o.shipping_amount) + Number(o.fee_amount))}.
        </p>
        <p>
          Seguimiento: {o.tracking ?? 'Sin despacho registrado'}. Revisión:{' '}
          {o.review_until ? new Date(o.review_until).toLocaleString('es-AR') : 'Aún no iniciada'}.
        </p>
      </section>
      {['pending_payment', 'payment_rejected'].includes(o.status) && (
        <CommerceForm id={id} action="cancel" label="Cancelar operación" />
      )}
      {seller && o.status === 'protected' && (
        <CommerceForm id={id} action="prepare" label="Comenzar preparación" />
      )}
      {seller && o.status === 'preparing' && (
        <CommerceForm id={id} action="dispatch" label="Registrar despacho">
          <label className="field">
            Código de seguimiento
            <input name="detail" minLength={4} maxLength={200} required />
          </label>
          <p>Adjuntá primero el comprobante de despacho.</p>
        </CommerceForm>
      )}
      {buyer && ['delivered', 'review'].includes(o.status) && (
        <CommerceForm id={id} action="accept" label="Acepto el equipo recibido">
          <p>
            Confirmo que es el dispositivo correcto y coincide con la descripción. Se solicitará la
            liberación al proveedor.
          </p>
        </CommerceForm>
      )}
      {buyer && o.status === 'return_requested' && (
        <CommerceForm id={id} action="return_dispatch" label="Registrar devolución">
          <label className="field">
            Código de seguimiento
            <input name="detail" minLength={4} maxLength={200} required />
          </label>
        </CommerceForm>
      )}
      <p>
        Identificador privado vinculado:{' '}
        {identifier.data
          ? identifier.data.kind + ': ' + identifier.data.identifier
          : 'No registrado'}
      </p>
      <h2>Centro de resoluciones</h2>
      {buyer &&
        !dispute.data?.length &&
        !['pending_payment', 'payment_rejected', 'canceled', 'refunded'].includes(o.status) && (
          <CommerceForm id={id} action="dispute" label="Abrir reclamo" text>
            <label className="field">
              Motivo
              <select name="reason">
                {Object.entries(disputeReasons).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <p>
              La ausencia de video no implica rechazo automático. Conservá el dispositivo y sus
              componentes.
            </p>
          </CommerceForm>
        )}
      {dispute.data?.map((d) => (
        <section className="notice" key={d.id}>
          <h3>{disputeReasons[d.reason as keyof typeof disputeReasons]}</h3>
          <p>{d.description}</p>
          <p>
            {d.status} · {d.resolution}
          </p>
        </section>
      ))}
      <CommerceForm id={id} action="message" label="Enviar respuesta al expediente" text />
      {messages.data?.map((m) => (
        <p className="notice" key={m.id}>
          {m.author_id === p.id ? 'Vos' : 'Otra parte / administración'}: {m.body}
        </p>
      ))}
      {(buyer || seller) && <EvidenceForm id={id} />}
      <ul>
        {signed.map((e) => (
          <li key={e.id}>
            {e.kind}:{' '}
            {e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer">
                Ver evidencia privada (enlace de 60 segundos)
              </a>
            ) : (
              'No disponible'
            )}
          </li>
        ))}
      </ul>
      {o.status === 'released' && (
        <CommerceForm id={id} action="review" label="Publicar valoración verificada" text>
          <label className="field">
            Puntuación
            <select name="rating">
              {[5, 4, 3, 2, 1].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </CommerceForm>
      )}
      <CommerceForm
        id={id}
        action="challenge_review"
        label="Solicitar revisión de una valoración recibida"
      />
      <h2>Historial</h2>
      {events.data?.map((e) => (
        <p key={e.id}>
          {new Date(e.created_at).toLocaleString('es-AR')} · {orderLabels[e.event] ?? e.event}{' '}
          {e.detail}
        </p>
      ))}
      <h2>Solicitudes financieras</h2>
      {requests.data?.map((r) => (
        <p key={r.id}>
          {r.action}: {r.status}. Solo la confirmación del proveedor acredita el movimiento.
        </p>
      ))}
    </div>
  );
}
