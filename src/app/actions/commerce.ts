'use server';
import { z } from 'zod';
import { db } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/types';
import { getProfile } from '@/lib/data';
import { adminDb } from '@/lib/supabase/admin';
import { sanitizePhoto } from '@/lib/photos';
export async function commerceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await db();
  if (!client || !(await getProfile())) return { error: 'Ingresá a tu cuenta.' };
  const id = z.uuid().safeParse(form.get('id'));
  const action = String(form.get('action'));
  const detail = String(form.get('detail') ?? '');
  if (detail.length > 2000) return { error: 'El texto es demasiado largo.' };
  let result;
  if (action === 'request_verification') result = await client.rpc('request_verification');
  else {
    if (!id.success) return { error: 'Identificador inválido.' };
    if (action === 'message')
      result = await client.rpc('order_message', { p_order: id.data, p_body: detail });
    else if (action === 'dispute')
      result = await client.rpc('open_dispute', {
        p_order: id.data,
        p_reason: form.get('reason'),
        p_description: detail,
      });
    else if (action === 'report')
      result = await client.rpc('report_listing', { p_device: id.data, p_reason: detail });
    else if (action === 'review')
      result = await client.rpc('submit_review', {
        p_order: id.data,
        p_rating: Number(form.get('rating')),
        p_body: detail,
      });
    else if (action === 'challenge_review')
      result = await client.rpc('challenge_review', { p_order: id.data });
    else if (action.startsWith('admin:'))
      result = await client.rpc('admin_commerce_action', {
        p_target: id.data,
        p_action: action.slice(6),
        p_reason: detail,
      });
    else
      result = await client.rpc('order_action', {
        p_order: id.data,
        p_action: action,
        p_detail: detail,
      });
  }
  if (result.error)
    return {
      error:
        'No se pudo registrar. Revisá los datos, tus permisos y el estado actual. No se movió dinero.',
    };
  revalidatePath('/operaciones');
  revalidatePath('/admin/comercio');
  revalidatePath('/verificacion');
  if (id.success) revalidatePath('/operaciones/' + id.data);
  return {
    success: 'Registrado. Una solicitud financiera no confirma un pago, liberación ni reembolso.',
  };
}
export async function uploadEvidence(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await db();
  const profile = await getProfile();
  const id = z.uuid().safeParse(form.get('id'));
  const kind = z
    .enum([
      'device',
      'identifier',
      'packing',
      'sealed_package',
      'dispatch',
      'delivery',
      'unboxing',
      'return',
    ])
    .safeParse(form.get('kind'));
  const file = form.get('photo');
  if (
    !client ||
    !profile ||
    !id.success ||
    !kind.success ||
    !(file instanceof File) ||
    file.size > 2097152
  )
    return { error: 'Seleccioná una foto de hasta 2 MB y un tipo de evidencia.' };
  const { data: order } = await client
    .from('protected_orders')
    .select('id,buyer_id,seller_id')
    .eq('id', id.data)
    .maybeSingle();
  if (!order || ![order.buyer_id, order.seller_id].includes(profile.id))
    return { error: 'Solo las partes pueden adjuntar evidencia.' };
  const { data: user } = await client
    .from('users')
    .select('verification_status')
    .eq('id', profile.id)
    .single();
  if (user?.verification_status === 'suspended') return { error: 'Cuenta suspendida.' };
  const { count } = await client
    .from('order_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', id.data);
  if ((count ?? 0) >= 30)
    return {
      error:
        'Límite de 30 evidencias por operación. Contactá a administración para ampliar el caso.',
    };
  const path = id.data + '/' + profile.id + '/' + crypto.randomUUID() + '.webp';
  const service = adminDb();
  try {
    const bytes = await sanitizePhoto(new Uint8Array(await file.arrayBuffer()));
    const stored = await service.storage
      .from('order-evidence')
      .upload(path, bytes, { contentType: 'image/webp', upsert: false });
    if (stored.error) throw stored.error;
    const saved = await service
      .from('order_evidence')
      .insert({ order_id: id.data, uploaded_by: profile.id, path, kind: kind.data });
    if (saved.error) {
      await service.storage.from('order-evidence').remove([path]);
      throw saved.error;
    }
    revalidatePath('/operaciones/' + id.data);
    return { success: 'Evidencia privada guardada. No constituye por sí sola prueba concluyente.' };
  } catch {
    return { error: 'No pudimos guardar la evidencia.' };
  }
}
