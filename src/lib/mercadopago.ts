import 'server-only';
import { adminDb } from './supabase/admin';
import { addCalendarMonth } from './payments';
type MPSubscription = {
  id: string;
  status: string;
  external_reference: string;
  init_point: string;
  auto_recurring: { transaction_amount: number; currency_id: string };
};
type MPPayment = {
  id: number;
  status: string;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  date_approved: string;
  external_reference: string;
};
type MPInvoice = {
  id: number;
  preapproval_id: string;
  debit_date: string;
  payment?: { id: number; status: string };
};
export async function mp<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  idempotency?: string,
): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error('payment_not_configured');
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(idempotency ? { 'X-Idempotency-Key': idempotency } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`mp_${res.status}`);
  return res.json();
}
export async function syncMPSubscription(id: string) {
  const remote = await mp<MPSubscription>(`/preapproval/${encodeURIComponent(id)}`);
  const client = adminDb();
  const { data: s, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('provider', 'mercadopago')
    .eq('provider_subscription_id', id)
    .maybeSingle();
  if (error) throw error;
  if (!s) return;
  if (remote.external_reference !== s.id) throw new Error('subscription_mismatch');
  // Authorization is not a payment. It must never grant access on its own.
  if (['cancelled', 'paused'].includes(remote.status)) {
    const { error: updateError } = await client
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('id', s.id);
    if (updateError) throw updateError;
  }
  const invoices = await mp<{ results: MPInvoice[] }>(
    `/authorized_payments/search?preapproval_id=${encodeURIComponent(id)}&limit=100`,
  );
  for (const invoice of invoices.results ?? []) {
    if (invoice.payment?.id)
      await syncMPPayment(String(invoice.payment.id), {
        subscriptionId: s.id,
        debitDate: invoice.debit_date,
      });
  }
}
export async function syncMPInvoice(id: string) {
  const invoice = await mp<MPInvoice>(`/authorized_payments/${encodeURIComponent(id)}`);
  if (!invoice.payment?.id) return;
  const { data: s, error } = await adminDb()
    .from('subscriptions')
    .select('id')
    .eq('provider', 'mercadopago')
    .eq('provider_subscription_id', invoice.preapproval_id)
    .maybeSingle();
  if (error) throw error;
  if (!s) return;
  await syncMPPayment(String(invoice.payment.id), {
    subscriptionId: s.id,
    debitDate: invoice.debit_date,
  });
}
export async function syncMPPayment(
  id: string,
  invoice?: { subscriptionId: string; debitDate: string },
) {
  const payment = await mp<MPPayment>(`/v1/payments/${encodeURIComponent(id)}`);
  if (!['approved', 'refunded', 'charged_back'].includes(payment.status)) return;
  const client = adminDb();
  const subscriptionId = invoice?.subscriptionId ?? payment.external_reference;
  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId ?? '')) return;
  const { data: s, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .eq('provider', 'mercadopago')
    .maybeSingle();
  if (error) throw error;
  if (!s) return;
  if (payment.external_reference !== s.id) throw new Error('payment_reference_mismatch');
  // A payment-only notification may arrive first. Resolve its invoice to avoid
  // attributing a standalone transfer to a recurring subscription.
  let debit = invoice?.debitDate;
  if (!debit) {
    const invoices = await mp<{ results: MPInvoice[] }>(
      `/authorized_payments/search?preapproval_id=${encodeURIComponent(s.provider_subscription_id)}&payment_id=${encodeURIComponent(id)}&limit=100`,
    );
    const match = invoices.results?.find(
      (i) => String(i.payment?.id) === id && i.preapproval_id === s.provider_subscription_id,
    );
    if (!match) throw new Error('invoice_not_available_yet');
    debit = match.debit_date;
  }
  if (
    Number(payment.transaction_amount) !== Number(s.price_amount) ||
    payment.currency_id !== s.currency
  )
    throw new Error('payment_amount_mismatch');
  const start = new Date(debit).toISOString();
  const { error: applyError } = await client.rpc('apply_payment', {
    p_subscription: s.id,
    p_external: String(payment.id),
    p_amount: payment.transaction_amount,
    p_currency: payment.currency_id,
    p_start: start,
    p_end: addCalendarMonth(start),
    p_status:
      payment.status === 'approved' && !payment.transaction_amount_refunded
        ? 'confirmed'
        : 'refunded',
  });
  if (applyError) throw applyError;
}
export type { MPSubscription };
