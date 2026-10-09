'use server';
import { db } from '@/lib/supabase/server';
import { getProfile } from '@/lib/data';
import { deviceSchema, catalogSchema } from '@/lib/validation';
import { adminDb } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/types';
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
  const files = form.getAll('photos').filter((x): x is File => x instanceof File && x.size > 0);
  if (files.length > 6 || files.some((f) => f.size > 5 * 1024 * 1024))
    return { error: 'Subí hasta 6 imágenes de 5 MB como máximo cada una.' };
  const paths: string[] = [];
  try {
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
      const webp =
        new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
        new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
      if (!jpeg && !png && !webp) throw new Error('Usá imágenes JPG, PNG o WebP válidas.');
      const ext = jpeg ? 'jpg' : png ? 'png' : 'webp';
      const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await client.storage
        .from('device-photos')
        .upload(path, bytes, {
          contentType: jpeg ? 'image/jpeg' : png ? 'image/png' : 'image/webp',
          upsert: false,
        });
      if (error) throw new Error('No pudimos subir una foto. Intentá nuevamente.');
      paths.push(path);
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
    if (paths.length) await client.storage.from('device-photos').remove(paths);
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
