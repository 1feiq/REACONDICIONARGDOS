'use server';
import { db } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { provinces } from '@/lib/config';
import type { ActionState } from '@/lib/types';
export async function sendAccessLink(_: ActionState, form: FormData): Promise<ActionState> {
  const client = await db();
  if (!client)
    return { error: 'Estamos preparando el registro. Todavía no se enviaron datos ni correos.' };
  const parsed = z
    .object({
      email: z.email(),
      display_name: z.string().trim().min(2).max(100),
      role: z.enum(['cliente', 'tecnico']),
      city: z.string().trim().min(2).max(80),
      province:z.enum(provinces),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Revisá tu nombre, correo y localidad.' };
  if (form.get('consent') !== 'on')
    return { error: 'Confirmá las condiciones de uso.' };
  const origin = process.env.APP_URL;
  if (!origin) return { error: 'El registro todavía no está habilitado.' };
  const { error } = await client.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: { display_name: parsed.data.display_name, role: parsed.data.role, city:parsed.data.city, province:parsed.data.province },
    },
  });
  return error
    ? { error: 'No pudimos enviar el enlace. Esperá un minuto y volvé a intentar.' }
    : {
        success:
          'Revisá tu correo (y spam). Te enviamos un enlace seguro para ingresar, sin contraseña.',
      };
}
export async function signOut() {
  const client = await db();
  await client?.auth.signOut();
  redirect('/');
}
