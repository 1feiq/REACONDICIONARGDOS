'use client';
import { useActionState, type ReactNode } from 'react';
import { commerceAction, uploadEvidence } from '@/app/actions/commerce';
export function CommerceForm({
  id,
  action,
  label,
  children,
  text = false,
}: {
  id?: string;
  action: string;
  label: string;
  children?: ReactNode;
  text?: boolean;
}) {
  const [state, submit, pending] = useActionState(commerceAction, {});
  return (
    <form action={submit} className="panel" style={{ marginBlock: 16 }}>
      <input type="hidden" name="id" value={id ?? ''} />
      <input type="hidden" name="action" value={action} />
      {children}
      {text && (
        <label className="field">
          Detalle o fundamento
          <textarea name="detail" required minLength={15} maxLength={2000} />
        </label>
      )}
      <button className="button secondary" disabled={pending}>
        {pending ? 'Guardando…' : label}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
export function EvidenceForm({ id }: { id: string }) {
  const [state, submit, pending] = useActionState(uploadEvidence, {});
  return (
    <form action={submit} className="panel">
      <h3>Adjuntar evidencia privada</h3>
      <input type="hidden" name="id" value={id} />
      <label className="field">
        Tipo
        <select name="kind">
          {Object.entries({
            device: 'Dispositivo antes de embalar',
            identifier: 'IMEI o serie',
            packing: 'Embalaje',
            sealed_package: 'Paquete cerrado',
            dispatch: 'Comprobante de despacho',
            delivery: 'Entrega',
            unboxing: 'Recepción',
            return: 'Devolución',
          }).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Foto JPG, PNG o WebP, hasta 2 MB
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
      </label>
      <p>
        Acceso limitado a las partes y administración. La ausencia de un video no invalida un
        reclamo. Los videos están pendientes de un servicio privado de procesamiento.
      </p>
      <button className="button secondary" disabled={pending}>
        Guardar evidencia
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
