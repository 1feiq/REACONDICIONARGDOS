'use server';
import { db } from '@/lib/supabase/server';
import { getProfile } from '@/lib/data';
import { deviceSchema, catalogSchema } from '@/lib/validation';
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
  try {
    for (const path of paths) {
      const { error } = await adminDb().storage.from('device-photos').info(path);
      if (error) throw new Error('Faltan fotos por subir. Intentá nuevamente.');
    }
    const { data, error } = await client.rpc('save_device', {
      p: { ...parsed.data, photo_paths: paths },
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
          ? 'Tu publicación ya está disponible.'
          : 'Borrador guardado. Para publicarlo, confirmá la autorización desde administración.',
      id: data,
    };
  } catch (error) {
    // shortcut: abandoned uploads remain until a retention/cleanup job is configured before launch.
    return { error: error instanceof Error ? error.message : 'No pudimos guardar la publicación.' };
  }
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
