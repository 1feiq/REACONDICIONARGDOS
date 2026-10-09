'use client';
import { useActionState } from 'react';
import { saveAlert, readAlerts } from '@/app/actions/alerts';
import { categories } from '@/lib/config';
export function AlertPreferences({ category, enabled }: { category: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(saveAlert, {});
  return (
    <form action={action}>
      <label className="field">
        Equipos que te interesan
        <select name="category" defaultValue={category}>
          <option value="todas">Todas las categorías</option>
          {Object.entries(categories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        Avisarme dentro de mi cuenta cuando haya nuevas publicaciones.
      </label>
      <button className="button secondary" disabled={pending}>
        Guardar alerta
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
export function ReadAlerts({ cutoff }: { cutoff: string }) {
  const [state, action, pending] = useActionState(readAlerts, {});
  return (
    <form action={action}>
      <input type="hidden" name="cutoff" value={cutoff} />
      <button className="button secondary small" disabled={pending}>
        Marcar todas como leídas
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
