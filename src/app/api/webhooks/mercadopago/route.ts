import { verifyMPSignature } from '@/lib/payments';
import { syncMPInvoice, syncMPPayment, syncMPSubscription } from '@/lib/mercadopago';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'not_configured' }, { status: 503 });
  const url = new URL(request.url);
  const id = url.searchParams.get('data.id') ?? '';
  if (
    !/^[a-zA-Z0-9-]{1,100}$/.test(id) ||
    !verifyMPSignature(
      request.headers.get('x-signature'),
      request.headers.get('x-request-id'),
      id,
      secret,
    )
  )
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  let body: { type?: string; data?: { id?: string | number } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (String(body.data?.id ?? '') !== id)
    return Response.json({ error: 'id_mismatch' }, { status: 400 });
  try {
    if (body.type === 'subscription_authorized_payment') await syncMPInvoice(id);
    else if (body.type === 'subscription_preapproval') await syncMPSubscription(id);
    else if (body.type === 'payment') await syncMPPayment(id);
    return Response.json({ received: true });
  } catch (error) {
    console.error(
      'Mercado Pago notification could not be reconciled:',
      error instanceof Error ? error.message : 'unknown_error',
    );
    return Response.json({ error: 'retry_later' }, { status: 500 });
  }
}
