'use client';
import { useActionState } from 'react';
import { cleanAbandonedPhotos } from '@/app/actions/devices';
export function PhotoCleanup() {
  const [state, action, pending] = useActionState(cleanAbandonedPhotos, {});
  return (
    <form action={action} className="panel" style={{ marginTop: 30 }}>
      <h2>Fotos abandonadas</h2>
      <p>
        Eliminá hasta 100 fotos subidas hace más de 24 horas que no estén asociadas a ninguna
        publicación. Las fotos de borradores y publicaciones cerradas se conservan.
      </p>
      <label className="check">
        <input type="checkbox" name="confirm" required />
        Confirmo la eliminación definitiva de esas fotos sin publicación.
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
      <button className="button secondary" disabled={pending}>
        {pending ? 'Limpiando…' : 'Eliminar fotos abandonadas'}
      </button>
    </form>
  );
}
