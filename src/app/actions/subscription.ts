'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getProfile } from '@/lib/data';
import { adminDb } from '@/lib/supabase/admin';
import { mp, syncMPSubscription, type MPSubscription } from '@/lib/mercadopago';
import { MONTHLY_ARS, PRO_BILLING_READY } from '@/lib/config';
import type { ActionState } from '@/lib/types';
export async function checkout(_: ActionState): Promise<ActionState> {
  const profile = await getProfile();
  if (profile?.role !== 'tecnico')
    return { error: 'Ingresá con una cuenta de técnico para suscribirte.' };
  if (
    !PRO_BILLING_READY ||
    process.env.PAYMENTS_ENABLED !== 'true' ||
    !process.env.MERCADOPAGO_ACCESS_TOKEN ||
    !process.env.MERCADOPAGO_WEBHOOK_SECRET ||
    !process.env.APP_URL?.startsWith('https://')
  )
    return { error: 'Los cobros todavía no están habilitados. No se realizó ningún cargo.' };
  let url = '';
  try {
    const client = adminDb();
    let { data: s, error } = await client
      .from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .in('status', ['pending', 'active', 'past_due'])
      .maybeSingle();
    if (error) throw error;
    if (s && s.status !== 'pending')
      return {
        error:
          'Ya tenés una suscripción. Podés consultar o cancelar su renovación desde esta página.',
      };
    if (!s) {
      const result = await client
        .from('subscriptions')
        .insert({
          user_id: profile.id,
          provider: 'mercadopago',
          status: 'pending',
          price_amount: MONTHLY_ARS,
          currency: 'ARS',
        })
        .select()
        .single();
      if (result.error) throw result.error;
      s = result.data;
    }
    const remote = s.provider_subscription_id
      ? await mp<MPSubscription>(`/preapproval/${encodeURIComponent(s.provider_subscription_id)}`)
      : await mp<MPSubscription>(
          '/preapproval',
          'POST',
          {
            reason: 'reacondicionargdos · Plan Técnico mensual',
            external_reference: s.id,
            payer_email: profile.email,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: MONTHLY_ARS,
              currency_id: 'ARS',
            },
            back_url: `${process.env.APP_URL}/suscripcion?retorno=1`,
            status: 'pending',
          },
          s.id,
        );
    const { error: updateError } = await client
      .from('subscriptions')
      .update({ provider_subscription_id: remote.id })
      .eq('id', s.id);
    if (updateError) throw updateError;
    const parsed = new URL(remote.init_point);
    if (
      parsed.protocol !== 'https:' ||
      !['www.mercadopago.com.ar', 'www.mercadopago.com'].includes(parsed.hostname)
    )
      throw new Error('invalid_checkout_url');
    url = parsed.toString();
  } catch {
    return {
      error:
        'No pudimos abrir el pago. Volvé a intentar; no se habilita acceso hasta confirmar el cobro.',
    };
  }
  redirect(url);
}
export async function refreshSubscription(_: ActionState): Promise<ActionState> {
  const profile = await getProfile();
  if (!profile) return { error: 'Ingresá a tu cuenta.' };
  try {
    const { data, error } = await adminDb()
      .from('subscriptions')
      .select('provider_subscription_id')
      .eq('user_id', profile.id)
      .eq('provider', 'mercadopago')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.provider_subscription_id)
      return { error: 'Todavía no hay una suscripción para verificar.' };
    await syncMPSubscription(data.provider_subscription_id);
    revalidatePath('/suscripcion');
    return {
      success: 'Estado consultado. El contacto se habilita cuando Mercado Pago confirma el pago.',
    };
  } catch {
    return { error: 'No pudimos consultar Mercado Pago. Intentá nuevamente en unos instantes.' };
  }
}
export async function cancelSubscription(_: ActionState, form: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!profile) return { error: 'Ingresá a tu cuenta.' };
  if (form.get('confirm') !== 'on') return { error: 'Confirmá que querés cancelar la renovación.' };
  try {
    const client = adminDb();
    const { data: s, error } = await client
      .from('subscriptions')
      .select('*')
      .eq('id', form.get('id'))
      .eq('user_id', profile.id)
      .eq('provider', 'mercadopago')
      .single();
    if (error) throw error;
    if (s.provider_subscription_id) {
      const remote=await mp<MPSubscription>(`/preapproval/${encodeURIComponent(s.provider_subscription_id)}`, 'PUT', {status:'cancelled'});
      if(remote.id!==s.provider_subscription_id||remote.status!=='cancelled')throw new Error('cancellation_not_confirmed');
    }
    const { error: updateError } = await client
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('id', s.id);
    if (updateError) throw updateError;
    revalidatePath('/suscripcion');
    return { success: 'Renovación cancelada. Conservás el acceso durante el período pagado.' };
  } catch {
    return {
      error:
        'No pudimos cancelar la renovación. Intentá nuevamente o gestionála desde Mercado Pago.',
    };
  }
}
