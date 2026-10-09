'use client';
import { useActionState } from 'react';
import { checkout, cancelSubscription, refreshSubscription } from '@/app/actions/subscription';
export function CheckoutButton({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(checkout, {});
  return (
    <form action={action}>
      {state.error && (
        <div className="notice error" role="alert">
          {state.error}
        </div>
      )}
      <button className="button full" disabled={!enabled || pending}>
        {pending
          ? 'Abriendo Mercado Pago…'
          : enabled
            ? 'Suscribirme con Mercado Pago'
            : 'Suscripciones próximamente'}
      </button>
      {!enabled && <p className="quote-foot">Todavía no aceptamos pagos.</p>}
    </form>
  );
}
export function SubscriptionControls({ id, canceled }: { id: string; canceled: boolean }) {
  const [cancel, cancelAction, cancelPending] = useActionState(cancelSubscription, {});
  const [refresh, refreshAction, refreshPending] = useActionState(refreshSubscription, {});
  return (
    <>
      <form action={refreshAction}>
        <button className="button secondary full" disabled={refreshPending}>
          {refreshPending ? 'Consultando…' : 'Actualizar estado del pago'}
        </button>
        {refresh.error && <p role="alert">{refresh.error}</p>}
        {refresh.success && <p role="status">{refresh.success}</p>}
      </form>
      {!canceled && (
        <form action={cancelAction}>
          <input name="id" value={id} type="hidden" />
          <label className="check">
            <input name="confirm" type="checkbox" required />
            <span>
              Quiero detener la renovación mensual. Pierdo el precio fundador para futuras
              suscripciones; conservo el período abonado.
            </span>
          </label>
          <button className="button secondary full" disabled={cancelPending}>
            {cancelPending ? 'Cancelando…' : 'Cancelar renovación'}
          </button>
          {cancel.error && <p role="alert">{cancel.error}</p>}
          {cancel.success && <p role="status">{cancel.success}</p>}
        </form>
      )}
    </>
  );
}
