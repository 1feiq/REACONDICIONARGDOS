'use server';
import { db } from '@/lib/supabase/server';
import { getProfile } from '@/lib/data';
import { deviceSchema, deviceSpecsSchema, catalogSchema } from '@/lib/validation';
import { adminDb } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/types';
import { sanitizePhoto } from '@/lib/photos';
import { z } from 'zod';

export async function uploadPhoto(form: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!profile) return { error: 'Ingresá antes de subir fotos.' };
  const file = form.get('photo');
  if (!(file instanceof File) || file.size > 2 * 1024 * 1024)
    return { error: 'Cada foto debe pesar como máximo 2 MB.' };
  try {
    const bytes = await sanitizePhoto(new Uint8Array(await file.arrayBuffer()));
    const path = `${profile.id}/${crypto.randomUUID()}.webp`;
    const { error } = await adminDb()
      .storage.from('device-photos')
      .upload(path, bytes, { contentType: 'image/webp', upsert: false });
    if (error) throw error;
    return { id: path };
  } catch {
    return {
      error: 'No pudimos procesar la foto. Usá una imagen JPG, PNG o WebP válida de hasta 2 MB.',
    };
  }
}

export async function saveDevice(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await db();
  const profile = await getProfile();
  if (!client || !profile) return { error: 'Ingresá a tu cuenta antes de publicar.' };
  const parsed = deviceSchema.safeParse({
    ...Object.fromEntries(form),
    permission: form.get('permission') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.source === 'admin' && profile.role !== 'admin')
    return { error: 'Esta función es solo para administradores.' };
  const parsedPaths = z
    .array(z.string().regex(new RegExp('^' + profile.id + '/[0-9a-f-]{36}\\.webp$')))
    .max(6)
    .safeParse(form.getAll('photo_paths'));
  if (!parsedPaths.success) return { error: 'Subí hasta 6 fotos válidas.' };
  const paths = parsedPaths.data;
  const specs = deviceSpecsSchema.safeParse({
    ...Object.fromEntries(form),
    accepts_offers: form.get('accepts_offers') === 'on',
  });
  if (!specs.success) return { error: specs.error.issues[0].message };
  if (!paths.length) return { error: 'Subí al menos una fotografía real.' };
  if (parsed.data.intent !== 'reparar' && !specs.data.asking_price)
    return { error: 'Indicá el precio solicitado.' };
  const identifier = String(form.get('identifier') ?? '').trim();
  const identifierKind = String(form.get('identifier_kind'));
  if (
    identifier &&
    !(
      (identifierKind === 'imei' && /^\d{15}$/.test(identifier)) ||
      (identifierKind === 'serial' && /^[A-Za-z0-9-]{5,32}$/.test(identifier))
    )
  )
    return { error: 'Revisá el IMEI (15 dígitos) o número de serie.' };
  try {
    for (const path of paths) {
      const { error } = await adminDb().storage.from('device-photos').info(path);
      if (error) throw new Error('Faltan fotos por subir. Intentá nuevamente.');
    }
    const { data, error } = await client.rpc('save_device', {
      p: {
        ...parsed.data,
        id:form.get('id'),
        photo_paths: paths,
        specs: specs.data,
        identifier,
        identifier_kind: identifierKind,
      },
    });
    if (error)
      throw new Error('No pudimos guardar la publicación. Revisá los datos e intentá nuevamente.');
    revalidatePath('/');
    revalidatePath('/equipos');
    revalidatePath('/cuenta');
    revalidatePath('/admin');
    return {
      success:
        parsed.data.status === 'publicado'
          ? 'Publicación guardada. Será visible cuando administración revise el contenido.'
          : 'Borrador guardado. Para publicarlo, confirmá la autorización desde administración.',
      id: data,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No pudimos guardar la publicación.' };
  }
}

export async function cleanAbandonedPhotos(_: ActionState, form: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (profile?.role !== 'admin' || form.get('confirm') !== 'on')
    return { error: 'Solo administración puede confirmar esta limpieza.' };
  const client = adminDb();
  const { data, error } = await client.rpc('claim_abandoned_photos');
  if (error) return { error: 'No pudimos identificar las fotos abandonadas.' };
  const paths = (data ?? []).map((row: { path: string }) => row.path);
  if (!paths.length) return { success: 'No hay fotos abandonadas con más de 24 horas.' };
  const result = await client.storage.from('device-photos').remove(paths);
  if (result.error) return { error: 'La limpieza no pudo completarse. Podés volver a intentarlo.' };
  return {
    success: `Se eliminaron ${paths.length} fotos abandonadas. Podés repetir la limpieza si hay más.`,
  };
}
export async function changeDeviceStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await db();
  if (!client) return { error: 'Ingresá para continuar.' };
  const { error } = await client.rpc('set_device_status', {
    p_id: form.get('id'),
    p_status: form.get('status'),
  });
  if (error)
    return {
      error: 'No se pudo cambiar el estado. Para publicar necesitás autorización confirmada.',
    };
  revalidatePath('/admin');
  revalidatePath('/cuenta');
  revalidatePath('/equipos');
  return { success: 'Estado actualizado.' };
}
export async function saveCatalog(_: ActionState, form: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (profile?.role !== 'admin') return { error: 'Acceso restringido.' };
  const result = catalogSchema.safeParse(Object.fromEntries(form));
  if (!result.success) return { error: result.error.issues[0].message };
  const { error } = await adminDb()
    .from('pricing_catalog')
    .upsert(
      { ...result.data, is_active: true, updated_at: new Date().toISOString() },
      { onConflict: 'category,brand,model,fault_code' },
    );
  if (error) return { error: 'No pudimos guardar los valores.' };
  revalidatePath('/');
  revalidatePath('/admin/cotizador');
  return { success: 'Valores actualizados.' };
}
export async function confirmContact(_: ActionState, form: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (profile?.role !== 'admin' || form.get('permission') !== 'on')
    return { error: 'Confirmá la autorización antes de publicar.' };
  const client = (await db())!;
  const { error } = await client.rpc('confirm_and_publish', { p_id: form.get('id') });
  if (error) return { error: 'No pudimos confirmar la publicación.' };
  revalidatePath('/admin');
  revalidatePath('/equipos');
  revalidatePath('/');
  return { success: 'Publicación confirmada.' };
}
