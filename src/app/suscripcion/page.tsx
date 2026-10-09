import Link from 'next/link';
import { Check } from 'lucide-react';
import { getProfile } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { MONTHLY_ARS, money } from '@/lib/config';
import { CheckoutButton, SubscriptionControls } from '@/components/subscription-buttons';
import { becomeTechnician } from '@/app/actions/auth';
export default async function Pricing({
  searchParams,
}: {
  searchParams: Promise<{ retorno?: string }>;
}) {
  const profile = await getProfile();
  const params = await searchParams;
  const client = await db();
  const subscription =
    profile && client
      ? (
          await client
            .from('subscriptions')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data
      : null;
  const enabled = Boolean(
    process.env.PAYMENTS_ENABLED === 'true' &&
    process.env.MERCADOPAGO_ACCESS_TOKEN &&
    process.env.MERCADOPAGO_WEBHOOK_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.APP_URL?.startsWith('https://'),
  );
  return (
    <div className="container page-shell">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <span className="eyebrow">Para técnicos y reacondicionadores</span>
        <h1>Más contactos. Más oportunidades.</h1>
        <p style={{ marginInline: 'auto' }}>
          Encontrá equipos de Rosario y conversá directamente con sus dueños.
        </p>
      </div>
      <div className="pricing panel">
        {params.retorno && (
          <div className="notice">
            Recibimos tu regreso de Mercado Pago. Actualizá el estado para verificar si el cobro fue
            confirmado.
          </div>
        )}
        <span className="badge green">PLAN TÉCNICO · ROSARIO</span>
        <div style={{ marginTop: 18 }}>
          <span className="price">{money(MONTHLY_ARS)}</span>
          <span className="muted"> ARS / mes</span>
        </div>
        <p>Una suscripción mensual. Sin comisión por operación.</p>
        <ul>
          {[
            'Contactos de publicaciones activas',
            'Equipos para comprar o reparar',
            'WhatsApp o email directo del titular',
            'Cancelación de renovación desde tu cuenta',
          ].map((t) => (
            <li key={t}>
              <Check size={19} />
              {t}
            </li>
          ))}
        </ul>
        {subscription && (
          <div className="notice">
            <strong>
              {
                (
                  {
                    pending: 'Pendiente de pago',
                    active: 'Suscripción activa',
                    past_due: 'Pago pendiente de regularizar',
                    canceled: 'Renovación cancelada',
                    expired: 'Suscripción vencida',
                  } as Record<string, string>
                )[subscription.status]
              }
            </strong>
            {subscription.access_until && (
              <p style={{ marginBottom: 0 }}>
                Último período registrado hasta{' '}
                {new Date(subscription.access_until).toLocaleDateString('es-AR', {
                  timeZone: 'America/Argentina/Buenos_Aires',
                })}
                . El acceso requiere un pago vigente confirmado.
              </p>
            )}
          </div>
        )}
        {!profile ? (
          <Link className="button full" href="/ingresar">
            Ingresar para suscribirme
          </Link>
        ) : profile.role === 'cliente' ? (
          <form action={becomeTechnician}>
            <button className="button full">Activar mi perfil de técnico</button>
          </form>
        ) : profile.role === 'admin' ? (
          <Link className="button full" href="/admin">
            Ir a administración
          </Link>
        ) : (
          (!subscription ||
            subscription.status === 'pending' ||
            subscription.status === 'canceled' ||
            subscription.status === 'expired') && <CheckoutButton enabled={enabled} />
        )}{' '}
        {subscription && (
          <SubscriptionControls
            id={subscription.id}
            canceled={subscription.status === 'canceled'}
          />
        )}
        <p className="quote-foot">
          La suscripción habilita contactos; no garantiza trabajos, ventas ni respuestas. Las
          condiciones de cada operación se acuerdan entre las partes.
        </p>
      </div>
    </div>
  );
}
