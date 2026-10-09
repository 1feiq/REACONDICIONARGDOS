'use client';
import { useActionState } from 'react';
import { confirmContact } from '@/app/actions/devices';
export function ConfirmContact({ id }: { id: string }) {
  const [state, action, pending] = useActionState(confirmContact, {});
  return (
    <form action={action}>
      <input name="id" value={id} type="hidden" />
      <label className="check">
        <input name="permission" type="checkbox" required />
        <span>Confirmé autorización y disponibilidad del equipo.</span>
      </label>
      <button className="button small" disabled={pending}>
        {pending ? 'Publicando…' : 'Confirmar y publicar'}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
