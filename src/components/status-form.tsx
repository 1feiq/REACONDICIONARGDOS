'use client';
import { useActionState } from 'react';
import { changeDeviceStatus } from '@/app/actions/devices';
export function StatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(changeDeviceStatus, {});
  return (
    <div>
      <form action={action} className="inline-form">
        <input name="id" value={id} type="hidden" />
        <select
          aria-label="Nuevo estado"
          name="status"
          defaultValue={status === 'borrador' ? 'publicado' : status}
          className="tab"
        >
          <option value="publicado">Publicado</option>
          <option value="cerrado">Cerrado</option>
          <option value="archivado">Archivado</option>
        </select>
        <button disabled={pending} className="button small secondary">
          {pending ? 'Guardando…' : 'Cambiar'}
        </button>
      </form>
      {state.error && (
        <p role="alert" style={{ color: '#a7282e', fontSize: '.8rem', marginTop: 10 }}>
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" style={{ fontSize: '.8rem', marginTop: 10 }}>
          {state.success}
        </p>
      )}
    </div>
  );
}
