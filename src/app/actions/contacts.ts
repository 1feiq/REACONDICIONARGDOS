'use server';
import { z } from 'zod';
import { db } from '@/lib/supabase/server';
export type ContactState = {
  error?: string;
  contact?: { contact_name: string; whatsapp_e164: string | null; contact_email: string | null };
};
export async function revealContact(_: ContactState, form: FormData): Promise<ContactState> {
  const id = z.uuid().safeParse(form.get('id'));
  const client = await db();
  if (!id.success || !client) return { error: 'Ingresá para consultar este contacto.' };
  const { data, error } = await client.rpc('reveal_contact', { p_device: id.data });
  if (error)
    return {
      error: error.message.includes('contact_daily_limit')
        ? 'Alcanzaste los 30 contactos distintos en las últimas 24 horas. Intentá más tarde.'
        : 'Necesitás una suscripción vigente y una publicación activa para ver el contacto.',
    };
  return data?.[0] ? { contact: data[0] } : { error: 'Este contacto ya no está disponible.' };
}
