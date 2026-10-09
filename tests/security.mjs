import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createHmac } from 'node:crypto';
import { verifyMPSignature, addCalendarMonth } from '../src/lib/payments.ts';
import { deviceSchema, safeNext } from '../src/lib/validation.ts';
const pg = new PGlite();
let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`PASS ${message}`);
}
async function denied(sql, message) {
  await assert.rejects(() => pg.query(sql));
  checks++;
  console.log(`PASS ${message}`);
}
await pg.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to anon,authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
);
for (const file of ['001_marketplace.sql', '003_publication_guards.sql', '005_contact_reveals.sql'])
  await pg.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
const owner = '11111111-1111-4111-8111-111111111111',
  tech = '22222222-2222-4222-8222-222222222222',
  other = '33333333-3333-4333-8333-333333333333',
  admin = '44444444-4444-4444-8444-444444444444';
for (const [id, role] of [
  [owner, 'cliente'],
  [tech, 'tecnico'],
  [other, 'cliente'],
  [admin, 'admin'],
])
  await pg.query(`insert into auth.users values($1,$2)`, [
    id,
    JSON.stringify({ display_name: 'Prueba', role }),
  ]);
ok(
  (await pg.query(`select role from public.users where id=$1`, [admin])).rows[0].role === 'cliente',
  'signup metadata cannot create an administrator',
);
await pg.query(`update public.users set role='admin' where id=$1`, [admin]);
async function login(id, role = 'authenticated') {
  await pg.exec('reset role');
  await pg.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id ?? '']);
  await pg.exec(`set role ${role}`);
}
const payload = {
  category: 'celular',
  brand: 'Apple',
  model: 'iPhone 11',
  intent: 'ambas',
  fault_code: 'pantalla_rota',
  description: 'Pantalla quebrada. El equipo enciende sin problemas.',
  city: 'Rosario',
  neighborhood: 'Centro',
  contact_name: 'Titular',
  whatsapp_e164: '+5493411234567',
  contact_email: '',
  source_url: '',
  permission: true,
  status: 'publicado',
  source: 'usuario',
  photo_paths: [],
};
await login(owner);
const device = (await pg.query('select public.save_device($1) id', [payload])).rows[0].id;
ok(Boolean(device), 'owner creates device and protected contact atomically');
await assert.rejects(() =>
  pg.query('select public.save_device($1)', [{ ...payload, city: 'Córdoba' }]),
);
checks++;
await assert.rejects(() =>
  pg.query('select public.save_device($1)', [{ ...payload, permission: false }]),
);
checks++;
await assert.rejects(() =>
  pg.query('select public.save_device($1)', [
    { ...payload, description: 'Llamame al 3411234567 por favor.' },
  ]),
);
checks++;
await assert.rejects(() =>
  pg.query('select public.save_device($1)', [{ ...payload, photo_paths: [`${other}/image.jpg`] }]),
);
checks++;
await denied(
  `update public.users set role='admin' where id='${owner}'`,
  'profile owner cannot promote their role',
);
await denied(
  `insert into public.subscriptions(user_id,provider,price_amount,currency) values('${owner}','mercadopago',15000,'ARS')`,
  'users cannot grant themselves subscriptions',
);
await denied(
  `select * from public.device_contacts`,
  'contact source URL and private metadata are not selectable by clients',
);
ok(
  (await pg.query('select whatsapp_e164 from public.device_contacts')).rows.length === 1,
  'owner can read their own contact',
);
await login(null, 'anon');
ok(
  (await pg.query('select * from public.devices')).rows.length === 1,
  'anonymous visitor can read published equipment',
);
await denied(
  'select whatsapp_e164 from public.device_contacts',
  'anonymous visitor cannot read contact',
);
await login(other);
ok(
  (await pg.query('select whatsapp_e164 from public.device_contacts')).rows.length === 0,
  'another client cannot read owner contact',
);
await denied(
  `select public.set_device_status('${device}','cerrado')`,
  'another client cannot close a listing',
);
await login(tech);
ok(
  (await pg.query('select whatsapp_e164 from public.device_contacts')).rows.length === 0,
  'unpaid technician cannot read contact',
);
await login(null, 'service_role');
const sub = (
  await pg.query(
    `insert into public.subscriptions(user_id,provider,provider_subscription_id,price_amount,currency) values($1,'mercadopago','test-remote',15000,'ARS') returning id`,
    [tech],
  )
).rows[0].id;
const start = new Date(Date.now() - 3600000).toISOString(),
  end = addCalendarMonth(start);
const apply = (external, status = 'confirmed', amount = 15000, a = start, b = end) =>
  pg.query('select public.apply_payment($1,$2,$3,$4,$5,$6,$7)', [
    sub,
    external,
    amount,
    'ARS',
    a,
    b,
    status,
  ]);
await apply('paid-1');
await apply('paid-1');
ok(
  (await pg.query('select * from public.subscription_payments')).rows.length === 1,
  'duplicate payment notifications do not duplicate payment or access',
);
await assert.rejects(() => apply('wrong-amount', 'confirmed', 1));
checks++;
await login(tech);
ok(
  (await pg.query('select * from public.reveal_contact($1)', [device])).rows.length === 1,
  'paid technician can explicitly reveal an active lead contact',
);
ok(
  (await pg.query('select whatsapp_e164 from public.device_contacts')).rows.length === 0,
  'paid technician cannot bulk select contacts',
);
await denied(
  'select * from private.contact_reveals',
  'technician cannot edit or inspect the reveal ledger',
);
await pg.query('select * from public.reveal_contact($1)', [device]);
await login(admin);
const extraDevices = [];
for (let i = 0; i < 30; i++)
  extraDevices.push(
    (await pg.query('select public.save_device($1) id', [{ ...payload, source: 'admin' }])).rows[0]
      .id,
  );
await login(tech);
for (const id of extraDevices.slice(0, 29))
  await pg.query('select * from public.reveal_contact($1)', [id]);
await denied(
  `select * from public.reveal_contact('${extraDevices[29]}')`,
  '31st distinct contact in 24 hours is rejected',
);
ok(
  (await pg.query('select * from public.reveal_contact($1)', [device])).rows.length === 1,
  'repeat reveal does not consume another slot',
);
await login(null);
await pg.query('reset role');
await pg.query(
  "update private.contact_reveals set revealed_at=now()-interval '25 hours' where user_id=$1",
  [tech],
);
await login(tech);
ok(
  (await pg.query('select * from public.reveal_contact($1)', [extraDevices[29]])).rows.length === 1,
  'quota resets as reveals leave the rolling window',
);
await denied(
  `select public.apply_payment('${sub}','forged',15000,'ARS',now(),now()+interval '1 month','confirmed')`,
  'payment reconciliation is service-only',
);
await login(owner);
await pg.query('select public.set_device_status($1,$2)', [device, 'cerrado']);
await login(tech);
ok(
  (await pg.query('select whatsapp_e164 from public.device_contacts')).rows.length === 0,
  'closed lead contact is hidden from paid technician',
);
await denied(
  `select * from public.reveal_contact('${device}')`,
  'closed contact cannot be explicitly revealed',
);
await login(owner);
await pg.query('select public.set_device_status($1,$2)', [device, 'publicado']);
await login(null, 'service_role');
await pg.query(`update public.subscriptions set status='canceled' where id=$1`, [sub]);
await login(tech);
ok(
  (await pg.query('select * from public.reveal_contact($1)', [device])).rows.length === 1,
  'canceling renewal preserves a paid period',
);
await login(null, 'service_role');
await apply('paid-1', 'refunded');
await apply('paid-1', 'confirmed');
await login(tech);
ok(
  (await pg.query('select whatsapp_e164 from public.device_contacts')).rows.length === 0,
  'refund revokes access and out-of-order approval cannot restore it',
);
await denied(
  `select * from public.reveal_contact('${device}')`,
  'refunded technician cannot reuse a prior reveal',
);
await login(null, 'service_role');
await apply('expired', 'confirmed', 15000, '2020-01-01T00:00:00Z', '2020-02-01T00:00:00Z');
await apply('future', 'confirmed', 15000, '2090-01-01T00:00:00Z', '2090-02-01T00:00:00Z');
await login(tech);
ok(
  (await pg.query('select whatsapp_e164 from public.device_contacts')).rows.length === 0,
  'gap between expired and future payments does not unlock contacts',
);
await login(admin);
const draft = (
  await pg.query('select public.save_device($1) id', [
    { ...payload, source: 'admin', status: 'borrador', permission: false },
  ])
).rows[0].id;
await denied(
  `select public.set_device_status('${draft}','publicado')`,
  'manual lead requires authorization before publication',
);
await pg.query('select public.confirm_and_publish($1)', [draft]);
ok(
  (await pg.query(`select * from public.devices where id=$1`, [draft])).rows[0].status ===
    'publicado',
  'admin can confirm authorization and publish atomically',
);
await login(null);
await pg.exec(
  'reset role; create schema storage; create table storage.objects(name text primary key,bucket_id text,created_at timestamptz);',
);
await pg.exec(
  readFileSync(new URL('../supabase/migrations/006_photo_cleanup.sql', import.meta.url), 'utf8'),
);
const keptPhoto = admin + '/kept.webp',
  orphanPhoto = admin + '/orphan.webp',
  freshPhoto = admin + '/fresh.webp';
await pg.query(
  "insert into storage.objects values ($1,'device-photos',now()-interval '2 days'),($2,'device-photos',now()-interval '2 days'),($3,'device-photos',now())",
  [keptPhoto, orphanPhoto, freshPhoto],
);
await login(admin);
await pg.query('select public.save_device($1)', [
  { ...payload, source: 'admin', status: 'borrador', photo_paths: [keptPhoto] },
]);
await denied(
  'select * from public.claim_abandoned_photos()',
  'cleanup RPC cannot be called with a user token',
);
await login(null, 'service_role');
const abandoned = (await pg.query('select * from public.claim_abandoned_photos()')).rows;
ok(
  abandoned.length === 1 && abandoned[0].path === orphanPhoto,
  'cleanup preserves referenced and recent photos',
);
ok(
  (await pg.query('select * from public.claim_abandoned_photos()')).rows.length === 1,
  'failed storage deletions remain retryable',
);
await login(admin);
await assert.rejects(() =>
  pg.query('select public.save_device($1)', [
    { ...payload, source: 'admin', photo_paths: [orphanPhoto] },
  ]),
);
checks++;
console.log('PASS retired photo cannot be attached while deletion is pending');
await pg.exec('reset role');
await pg.exec(
  readFileSync(new URL('../supabase/migrations/007_listing_alerts.sql', import.meta.url), 'utf8'),
);
await login(tech);
await pg.query("insert into public.listing_alerts(user_id,category) values($1,'celular')", [tech]);
ok(
  (await pg.query('select * from public.listing_alerts')).rows.length === 1,
  'user can save their own listing alert',
);
await login(other);
ok(
  (await pg.query('select * from public.listing_alerts')).rows.length === 0,
  'other users cannot read alert preferences',
);
await denied(
  `insert into public.listing_alerts(user_id) values('${owner}')`,
  'cannot enable alerts for another person',
);
await login(tech);
await denied(
  "update public.listing_alerts set category='invalid'",
  'alert category constrained in database',
);
await pg.query('update public.listing_alerts set enabled=false');
ok(
  (await pg.query('select enabled from public.listing_alerts')).rows[0].enabled === false,
  'user can disable listing alerts',
);
const now = Date.now(),
  ts = String(now),
  id = 'abc123',
  rid = 'test-request',
  secret = 'test-only-secret';
const hash = createHmac('sha256', secret)
  .update(`id:${id};request-id:${rid};ts:${ts};`)
  .digest('hex');
ok(
  verifyMPSignature(`ts=${ts},v1=${hash}`, rid, id, secret, now),
  'valid Mercado Pago signature accepted',
);
ok(
  !verifyMPSignature(`ts=${ts},v1=${hash}`, rid, 'another-id', secret, now),
  'tampered webhook ID rejected',
);
ok(
  !verifyMPSignature(`ts=${ts},v1=${hash}`, rid, id, secret, now + 600001),
  'stale webhook signature rejected',
);
ok(!verifyMPSignature(null, rid, id, secret), 'missing webhook signature rejected');
ok(
  addCalendarMonth('2024-01-31T10:00:00Z') === '2024-02-29T10:00:00.000Z',
  'monthly access handles leap-year month-end',
);
ok(
  addCalendarMonth('2025-01-31T10:00:00Z') === '2025-02-28T10:00:00.000Z',
  'monthly access clamps non-leap-year month-end',
);
ok(
  !deviceSchema.safeParse({ ...payload, contact_email: '', whatsapp_e164: '' }).success,
  'empty contact rejected',
);
ok(
  safeNext('https://evil.example') === '/cuenta' && safeNext('//evil.example') === '/cuenta',
  'external redirect destinations rejected',
);
await pg.close();
console.log(`\n${checks} security and billing checks passed.`);
