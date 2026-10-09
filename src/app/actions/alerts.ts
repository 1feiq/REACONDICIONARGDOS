'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/types';
export async function saveAlert(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await db();
  const user = client && (await client.auth.getUser()).data.user;
  const category = z
    .enum(['todas', 'celular', 'notebook', 'consola'])
    .safeParse(form.get('category'));
  if (!client || !user || !category.success)
    return { error: 'Ingresá y elegí una categoría válida.' };
  const values = { category: category.data, enabled: form.get('enabled') === 'on' };
  const existing = await client
    .from('listing_alerts')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing.error) return { error: 'No pudimos guardar tu alerta.' };
  const { error } = existing.data
    ? await client.from('listing_alerts').update(values).eq('user_id', user.id)
    : await client.from('listing_alerts').insert({ user_id: user.id, ...values });
  if (error) return { error: 'No pudimos guardar tu alerta.' };
  revalidatePath('/cuenta');
  return { success: 'Preferencia guardada. Las novedades aparecerán en tu cuenta.' };
}
export async function readAlerts(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await db();
  const user = client && (await client.auth.getUser()).data.user;
  const cutoff = z.iso.datetime().safeParse(form.get('cutoff'));
  if (!client || !user || !cutoff.success || Date.parse(cutoff.data) > Date.now())
    return { error: 'Volvé a abrir tu cuenta e intentá nuevamente.' };
  const { error } = await client
    .from('listing_alerts')
    .update({ seen_at: cutoff.data })
    .eq('user_id', user.id)
    .lt('seen_at', cutoff.data);
  if (error) return { error: 'No pudimos marcar las novedades como leídas.' };
  revalidatePath('/cuenta');
  return { success: 'Novedades marcadas como leídas.' };
}
