'use client';
import { useActionState } from 'react';
import { saveCatalog } from '@/app/actions/devices';
import { categories, faults } from '@/lib/config';
export function CatalogForm() {
  const [state, action, pending] = useActionState(saveCatalog, {});
  return (
    <form action={action}>
      <div className="form-grid">
        <label className="field">
          Categoría
          <select name="category">
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Falla
          <select name="fault_code">
            {Object.entries(faults).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Marca
          <input name="brand" required />
        </label>
        <label className="field">
          Modelo
          <input name="model" required />
        </label>
      </div>
      {[
        ['repair', 'Costo de reparación'],
        ['resale_broken', 'Reventa con falla'],
        ['resale_repaired', 'Reventa reparado'],
      ].map(([key, label]) => (
        <div className="form-grid" key={key}>
          <label className="field">
            {label} · mínimo ARS
            <input name={`${key}_min_ars`} type="number" min="0" step="0.01" required />
          </label>
          <label className="field">
            {label} · máximo ARS
            <input name={`${key}_max_ars`} type="number" min="0" step="0.01" required />
          </label>
        </div>
      ))}
      <label className="field">
        Supuestos de la estimación
        <textarea
          name="assumptions"
          minLength={10}
          maxLength={1000}
          required
          placeholder="Ej. Equipo que enciende, sin humedad ni otras fallas. Incluye repuesto y mano de obra."
        />
      </label>
      {state.error && (
        <div className="notice error" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="notice success" role="status">
          {state.success}
        </div>
      )}
      <button className="button" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar o actualizar valores'}
      </button>
    </form>
  );
}
