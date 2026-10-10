'use client';
import { LocationFields } from './location-fields';
import { DeviceSpecFields } from './device-spec-fields';
import { useActionState } from 'react';
import Link from 'next/link';
import { saveDevice, uploadPhoto } from '@/app/actions/devices';
import { categories, intents, faults } from '@/lib/config';
import { preparePhoto } from '@/lib/prepare-photo';
import type { ActionState } from '@/lib/types';
export function DeviceForm({
  initial,
  admin = false,
  initialModel = '',
  initialFault = 'pantalla_rota',
}: {
  initial?: Record<string, string>;
  admin?: boolean;
  initialModel?: string;
  initialFault?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (previous, form) => {
    const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length + form.getAll('photo_paths').length > 6) return { error: 'Elegí hasta 6 fotos.' };
    form.delete('photos');

    try {
      for (const file of files) {
        const photo = new FormData();
        photo.set('photo', await preparePhoto(file), 'photo.webp');
        const uploaded = await uploadPhoto(photo);
        if (!uploaded.id) return { error: uploaded.error ?? 'No pudimos subir la foto.' };
        form.append('photo_paths', uploaded.id);
      }
      return await saveDevice(previous, form);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'No pudimos procesar las fotos.' };
    }
  }, {});
  return (
    <form action={action}>
      <input type="hidden" name="source" value={admin ? 'admin' : 'usuario'} />
      <input type="hidden" name="country_code" value="AR" />
      {initial?.id && <input type="hidden" name="id" value={initial.id}/>}
      <h2 className="form-heading">01 · El equipo</h2>
      <div className="form-grid">
        <label className="field">
          Categoría
          <select name="category" defaultValue={initial?.category}>
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          ¿Qué querés hacer?
          <select name="intent" defaultValue={initial?.intent??'ambas'}>
            {Object.entries(intents).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          Marca
          <input name="brand" defaultValue={initial?.brand} required maxLength={60} placeholder="Ej. Apple, Samsung, Lenovo" />
        </label>
        <label className="field">
          Modelo
          <input
            name="model"
            defaultValue={initial?.model??initialModel}
            required
            maxLength={100}
            placeholder="Ej. iPhone 11"
          />
        </label>
      </div>
      <label className="field">
        Falla principal
        <select name="fault_code" defaultValue={initial?.fault_code??initialFault}>
          {Object.entries(faults).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Contanos qué pasó
        <textarea
          name="description" defaultValue={initial?.description}
          required
          minLength={15}
          maxLength={2000}
          placeholder="¿Enciende? ¿Qué dejó de funcionar? ¿Tiene accesorios?"
        />
        <small>No incluyas teléfonos, correos ni enlaces en la descripción.</small>
      </label>
      {initial?.photos && JSON.parse(initial.photos).map((path:string)=><label className="check" key={path}><input type="checkbox" name="photo_paths" value={path} defaultChecked/>Conservar foto {path.split('/').pop()?.slice(0,8)}</label>)}
      <DeviceSpecFields initial={initial} />
      <label className="field">
        Fotos del equipo
        <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        <small>
          Hasta 6 fotos. Las optimizamos a 1600 px y hasta 2 MB por imagen, quitando los metadatos
          GPS. Evitá datos personales, ubicaciones visibles y capturas con teléfonos.
        </small>
      </label>
      <div className="form-grid">
        <LocationFields city={initial?.city} province={initial?.province}/>
        <label className="field">
          Barrio (opcional)
          <input name="neighborhood" defaultValue={initial?.neighborhood} maxLength={80} placeholder="Ej. Centro" />
        </label>
      </div>
      <hr className="divider" />
      <h2 className="form-heading">02 · Contacto protegido</h2>
      <p style={{ fontSize: '.9rem' }}>
        Las personas registradas podrán consultar estos datos gratis, con límites contra abuso.
      </p>
      <label className="field">
        Nombre de contacto
        <input name="contact_name" defaultValue={initial?.contact_name} required minLength={2} maxLength={100} autoComplete="name" />
      </label>
      <div className="form-grid">
        <label className="field">
          WhatsApp
          <input name="whatsapp_e164" defaultValue={initial?.whatsapp_e164} type="tel" placeholder="+5493411234567" />
          <small>Con prefijo internacional. Completá al menos un contacto.</small>
        </label>
        <label className="field">
          Email
          <input name="contact_email" defaultValue={initial?.contact_email} type="email" maxLength={254} />
        </label>
      </div>
      {admin && (
        <label className="field">
          Enlace de origen (solo administración)
          <input name="source_url" defaultValue={initial?.source_url} type="url" placeholder="https://…" />
        </label>
      )}
      {!admin && <input type="hidden" name="source_url" value="" />}
      <label className="check">
        <input name="permission" type="checkbox" required={!admin} />
        <span>
          {admin
            ? 'Tengo autorización del titular para publicar el equipo y compartir su contacto con usuarios registrados. Confirmé que sigue disponible.'
            : 'Autorizo la publicación de mi equipo y que los usuarios registrados accedan a mi contacto. Confirmo que está en Argentina y acepto las condiciones de uso.'}
        </span>
      </label>
      {admin ? (
        <label className="field">
          Guardar como
          <select name="status">
            <option value="borrador">Borrador</option>
            <option value="publicado">Publicado (requiere autorización)</option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="status" value="publicado" />
      )}
      {state.error && (
        <div className="notice error" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="notice success" role="status">
          {state.success}{' '}
          <Link className="text-link" href={admin ? '/admin' : '/cuenta'}>
            Ver mis publicaciones
          </Link>
        </div>
      )}
      <button className="button full" disabled={pending || Boolean(state.id)}>
        {pending
          ? 'Guardando publicación…'
          : state.id
            ? 'Publicación guardada'
            : admin
              ? 'Guardar publicación'
              : 'Publicar mi equipo gratis'}
      </button>
      <p className="quote-foot">
        Acordás precio, reparación y entrega directamente con el técnico.
      </p>
    </form>
  );
}
