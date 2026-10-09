import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyMPSignature(
  signature: string | null,
  requestId: string | null,
  dataId: string,
  secret: string,
  now = Date.now(),
) {
  if (!signature || !requestId || !dataId || !secret) return false;
  const parts = Object.fromEntries(signature.split(',').map((p) => p.trim().split('=')));
  const { ts, v1 } = parts;
  if (!ts || !/^\d+$/.test(ts) || !v1 || !/^[a-f0-9]{64}$/i.test(v1)) return false;
  const timestamp = Number(ts) * (ts.length <= 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) return false;
  const digest = createHmac('sha256', secret)
    .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(v1, 'hex'));
}
export function addCalendarMonth(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid_date');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const maxDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, maxDay));
  return date.toISOString();
}
