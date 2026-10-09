import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
const pg = new PGlite();
let checks = 0;
const q = (sql, args = []) => pg.query(sql, args);
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
  console.log('PASS ' + m);
};
const denied = async (fn, m) => {
  await assert.rejects(fn);
  checks++;
  console.log('PASS ' + m);
};
await pg.exec(
  "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to anon,authenticated,service_role;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
);
for (const file of [
  '001_marketplace.sql',
  '003_publication_guards.sql',
  '005_contact_reveals.sql',
  '008_founders.sql',
  '009_protected_commerce.sql',
  '011_commerce_privacy.sql',
])
  await pg.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
async function login(id = null, role = 'authenticated') {
  await pg.exec('reset role');
  await q("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
  await pg.exec('set role ' + role);
}
async function root() {
  await pg.exec('reset role');
  await q("select set_config('request.jwt.claim.sub','',false)");
}
async function user(role = 'tecnico') {
  await root();
  const id = randomUUID();
  await q('insert into auth.users values($1,$2)', [id, { display_name: 'Test', role }]);
  return id;
}
async function sub(u) {
  await root();
  return (
    await q(
      "insert into public.subscriptions(user_id,provider,price_amount,currency,billing_version,terms_version) values($1,'mercadopago',10000,'ARS',2,'founders-v1') returning id",
      [u],
    )
  ).rows[0].id;
}
async function pay(s, n, amount = 7500, external = s + '-' + n, status = 'confirmed') {
  await login(null, 'service_role');
  return q('select public.apply_pro_payment($1,$2,$3,$4,$5,$6,$7)', [
    s,
    external,
    amount,
    new Date(Date.UTC(2026, n - 1, 1)).toISOString(),
    new Date(Date.UTC(2026, n, 1)).toISOString(),
    n,
    status,
  ]);
}
const users = [];
for (let i = 0; i < 102; i++) users.push(await user());
const first = await sub(users[0]);
await login(users[0]);
ok(
  (await q('select public.founder_availability() n')).rows[0].n === 100,
  'free registrations do not consume founder slots',
);
await denied(
  () =>
    q("select public.apply_pro_payment($1,'fake',7500,'2026-01-01','2026-02-01',1,'confirmed')", [
      first,
    ]),
  'client cannot confirm payment',
);
await denied(
  () => pay(first, 1, 7500, first + '-reject', 'rejected'),
  'rejected payment cannot grant a slot',
);
await denied(() => pay(first, 1, 10000), 'wrong first-founder amount rolls back allocation');
await pay(first, 1);
await pay(first, 1);
await root();
ok(
  (await q('select billed_cycles from public.subscriptions where id=$1', [first])).rows[0]
    .billed_cycles === 1,
  'duplicate webhook counts exactly one cycle',
);
await denied(
  () => pay(first, 1, 7500, 'another-payment-same-cycle'),
  'different payment cannot charge same cycle twice',
);
for (let i = 1; i < 99; i++) {
  const s = await sub(users[i]);
  await pay(s, 1);
}
const candidates=[await sub(users[99]),await sub(users[100])];
await login(null,'service_role');
const race=await Promise.allSettled(candidates.map(id=>q("select public.apply_pro_payment($1,$2,7500,'2026-01-01','2026-02-01',1,'confirmed')",[id,id+'-1'])));
ok(race.filter(r=>r.status==='fulfilled').length===1,'two queued confirmations competing for the final slot produce one winner');
const loser=race.findIndex(r=>r.status==='rejected');
await root();
ok(
  (await q('select count(*)::integer n from public.founder_slots where user_id is not null'))
    .rows[0].n === 100,
  '100th confirmed account receives final slot',
);
const next = candidates[loser];
await denied(() => pay(next, 1), '101st account cannot settle promotional amount');
await pay(next, 1, 10000);
await root();
ok(
  (await q('select count(*)::integer n from public.founder_slots where user_id=$1', [users[99+loser]]))
    .rows[0].n === 0,
  '101st account pays standard and consumes no slot',
);
for (let n = 2; n <= 6; n++) await pay(first, n);
await root();
ok(
  Number(
    (await q('select price_amount from public.subscriptions where id=$1', [first])).rows[0]
      .price_amount,
  ) === 10000,
  'after sixth payment next contracted price is 10000',
);
await denied(() => pay(first, 7, 7500), 'seventh payment cannot renew at promotional amount');
await pay(first, 7, 10000);
await pay(first, 1);
await root();
ok(
  (await q('select billed_cycles from public.subscriptions where id=$1', [first])).rows[0]
    .billed_cycles === 7,
  'late duplicate first payment cannot reset cycles',
);
await q("update public.subscriptions set status='canceled',canceled_at='2026-07-15' where id=$1", [
  first,
]);
await denied(() => pay(first, 8, 10000), 'payment for a new period after cancellation is rejected');
await root();
ok(
  (
    await q('select access_until from public.subscriptions where id=$1', [first])
  ).rows[0].access_until
    .toISOString()
    .startsWith('2026-08-01'),
  'cancellation preserves paid period',
);
const resub = await sub(users[0]);
await denied(() => pay(resub, 1, 7500), 'cancellation forfeits future founder price');
await pay(resub, 1, 10000);
await root();
ok(
  (await q('select count(*)::integer n from public.founder_slots where user_id=$1', [users[0]]))
    .rows[0].n === 1,
  'one lifetime slot per account',
);
const refunded = (await q('select id from public.subscriptions where user_id=$1', [users[1]]))
  .rows[0].id;
await pay(refunded, 1, 7500, refunded + '-1', 'refunded');
await pay(refunded, 1);
await root();
ok(
  (await q('select revoked_at from public.subscriptions where id=$1', [refunded])).rows[0]
    .revoked_at,
  'refund cannot be undone by delayed approval',
);
await login(null,'service_role');
await assert.rejects(()=>q("select public.apply_payment($1,'bypass',10000,'ARS','2026-08-01','2026-09-01','confirmed')",[first]),/legacy_contract_required/);
checks++;console.log('PASS legacy reconciler cannot bypass founder rules');
// Commerce integration simulations live only in this isolated database.
const seller = await user('cliente'),
  buyer = await user('tecnico'),
  stranger = await user('cliente'),
  admin = await user('cliente');
await root();
await q("update public.users set role='admin' where id=$1", [admin]);
await q("update public.users set verification_status='verified' where id in ($1,$2)", [
  seller,
  buyer,
]);
async function device() {
  await root();
  return (
    await q(
      "insert into public.devices(owner_id,created_by,category,brand,model,intent,fault_code,description,status,source) values($1,$1,'celular','Apple','iPhone','vender','pantalla_rota','Pantalla rota declarada','publicado','usuario') returning id",
      [seller],
    )
  ).rows[0].id;
}
async function order() {
  const d = await device();
  await root();
  await q(
    "insert into public.device_specs values($1,'128 GB','Marcas','si','Rota','Desconocido','Desconocido','libre','Ninguna declarada',100000,true,'presencial',now())",
    [d],
  );
  await login(buyer);
  return (await q("select public.create_protected_order($1,'test-v1') id", [d])).rows[0].id;
}
const d = await device();
await login(buyer);
await denied(
  () => q("select public.create_protected_order($1,'test-v1')", [d]),
  'production default blocks creation and all protected payments',
);
await root();
await q(
  "update private.commerce_config set enabled=true,provider='test-provider',fee_bps=300,terms_version='test-v1'",
);
async function event(o, e, external = o + '-' + e, amount = 103000) {
  await login(null, 'service_role');
  return q('select public.apply_commerce_event($1,$2,$3,$4,$5,$6)', [
    o,
    external,
    e,
    amount,
    'ARS',
    'payment-' + o,
  ]);
}
async function action(o, a, who = buyer, detail = '') {
  await login(who);
  return q('select public.order_action($1,$2,$3)', [o, a, detail]);
}
async function claim(o, reason = 'wrong_product') {
  await login(buyer);
  return q(
    "select public.open_dispute($1,$2,'El dispositivo recibido no coincide con la descripción.')",
    [o, reason],
  );
}
async function decision(o, a) {
  await login(admin);
  return q(
    "select public.admin_commerce_action($1,$2,'Revisión documentada de pruebas y condiciones del proveedor.')",
    [o, a],
  );
}
async function delivered(o) {
  await event(o, 'protected');
  await action(o, 'prepare', seller);
  await root();
  await q(
    "insert into public.order_evidence(order_id,uploaded_by,path,kind) values($1,$2,$3,'dispatch')",
    [o, seller, o + '/' + seller + '/dispatch.webp'],
  );
  await action(o, 'dispatch', seller, 'TRACK-123');
  await event(o, 'in_transit');
  await event(o, 'delivered');
}
const a = await order();
await login(stranger);
ok(
  (await q('select * from public.protected_orders')).rows.length === 0,
  'stranger cannot read private orders',
);
await denied(
  () => q("update public.protected_orders set status='released' where id=$1", [a]),
  'frontend cannot forge order status',
);
await denied(() => action(a, 'cancel', stranger), 'stranger cannot mutate order');
await login(buyer);
await denied(
  () =>
    q(
      "select public.admin_commerce_action($1,'request_refund','Intento de autorización fraudulenta')",
      [a],
    ),
  'non-admin cannot decide resolutions',
);
await denied(
  () =>
    q("select public.apply_commerce_event($1,'forged','protected',103000,'ARS','payment')", [a]),
  'client cannot fake provider confirmation',
);
await denied(() => event(a, 'protected', a + '-wrong', 1), 'browser-controlled price rejected');
await delivered(a);
await event(a, 'protected');
await root();
ok(
  (
    await q(
      "select count(*)::integer n from public.financial_events where order_id=$1 and event='protected'",
      [a],
    )
  ).rows[0].n === 1,
  'repeated provider webhook is idempotent',
);
await denied(() => event(a, 'released'), 'no release without acceptance');
await action(a, 'accept');
await root();
ok(
  (await q('select status from public.protected_orders where id=$1', [a])).rows[0].status ===
    'accepted',
  'interrupted financial request remains pending, not falsely released',
);
await event(a, 'released');
await event(a, 'released');
await login(buyer);
await q("select public.submit_review($1,5,'Coincide con lo declarado')", [a]);
await denied(
  () => q("select public.submit_review($1,5,'Duplicada')", [a]),
  'one verified review per party and purchase',
);
ok(
  (await q('select public.public_reputation($1) r', [seller])).rows[0].r.sales === 1,
  'completed purchase updates seller reputation',
);
const b = await order();
await delivered(b);
await claim(b);
await denied(() => action(b, 'accept'), 'active claim prevents acceptance');
await denied(() => event(b, 'released'), 'active dispute prevents money release');
await decision(b, 'review_dispute');
await decision(b, 'request_return');
await action(b, 'return_dispatch', buyer, 'RETURN-123');
await denied(() => decision(b, 'request_refund'), 'return not received cannot yet request refund');
await event(b, 'return_received');
await decision(b, 'request_refund');
await event(b, 'refunded');
await root();
ok(
  (await q('select status from public.protected_orders where id=$1', [b])).rows[0].status ===
    'refunded',
  'return and provider-confirmed refund complete',
);
await denied(() => event(b, 'released'), 'refunded purchase cannot later release money');
const c = await order();
await event(c, 'rejected');
await action(c, 'cancel');
await denied(() => event(c, 'protected'), 'late payment cannot revive canceled order');
const e = await order();
await event(e, 'protected');
await claim(e, 'not_received');
await decision(e, 'review_dispute');
await decision(e, 'request_refund');
await event(e, 'refunded');
await root();
ok(
  (await q('select status from public.protected_orders where id=$1', [e])).rows[0].status ===
    'refunded',
  'non-shipment / non-receipt can be reviewed without unboxing video',
);
await login(buyer);
await denied(
  () => q("select public.submit_review($1,5,'No existió compra completada')", [e]),
  'refund or nonexistent completed purchase cannot generate fake reputation',
);
await denied(
  () => q("update public.users set verification_status='verified' where id=$1", [buyer]),
  'users cannot self-verify',
);
await root();
await q("insert into public.device_identifiers values($1,'123456789012345','imei')", [d]);
await login(stranger);
ok(
  (await q('select * from public.device_identifiers')).rows.length === 0,
  'IMEI not exposed to unrelated users',
);
await login(seller);
ok(
  (await q('select * from public.device_identifiers')).rows.length === 1,
  'owner can access private identifier',
);
await login(buyer);
await denied(() => q('delete from public.admin_audit'), 'audit history cannot be deleted by users');
await decision(stranger, 'suspend');
await login(stranger);
await denied(
  () => q("select public.report_listing($1,'Publicación con contenido sospechoso')", [d]),
  'suspended account blocked from actions',
);
await root();
ok(
  (await q('select billed_cycles from public.subscriptions where id=$1', [first])).rows[0]
    .billed_cycles === 7,
  'commerce events do not mutate Pro subscription accounting',
);

await root();
await pg.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(name text,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon,authenticated;");
await pg.exec(readFileSync(new URL('../supabase/migrations/010_private_evidence.sql',import.meta.url),'utf8'));
await q("insert into storage.objects values($1,'order-evidence')",[a+'/'+seller+'/dispatch.webp']);
await login(stranger);ok((await q('select * from storage.objects')).rows.length===0,'unrelated user cannot read evidence storage objects');
await login(buyer);ok((await q('select * from storage.objects')).rows.length===1,'participant can read only registered private evidence');
await login(null,'anon');ok((await q('select * from storage.objects')).rows.length===0,'anonymous access to evidence bucket is denied');
await root();ok((await q("select public,file_size_limit from storage.buckets where id='order-evidence'")).rows[0].public===false,'evidence bucket is private');
const evil=await order();
await denied(()=>event(evil,'protected',a+'-protected'),'provider event cannot be replayed against another order');
await event(evil,'protected');
await denied(()=>event(evil,'protected',evil+'-protected',1),'same event ID with changed amount rejected');
await root();ok((await q('select count(*)::integer n from public.financial_events where order_id=$1',[evil])).rows[0].n===1,'failed reconciliation is atomic and leaves no extra financial event');
await login(buyer);await denied(()=>q("select public.submit_review($1,5,'Inventada')",[randomUUID()]),'nonexistent purchase cannot be reviewed');
for(const reason of ['empty_package','identifier_mismatch','activation_lock','omitted_fault','damage','fraud']){
 const testOrder=await order();await event(testOrder,'protected');await claim(testOrder,reason);
 await root();ok((await q('select status from public.protected_orders where id=$1',[testOrder])).rows[0].status==='disputed','claim supported: '+reason);
}
await login(buyer);
await denied(()=>q('select reference from public.device_checks'),'external verification reference stays private');
await q("select public.order_message($1,'Respuesta del comprador')",[a]);
await login(seller);await q("select public.order_message($1,'Respuesta del vendedor')",[a]);
ok((await q('select * from public.order_messages where order_id=$1',[a])).rows.length===2,'both parties can respond with evidence context');
await root();
await q("insert into public.listing_reports(device_id,reporter_id,reason) values($1,$2,'Motivo de prueba de límite')",[d,buyer]);
await pg.close();
console.log(checks + ' founder and protected-commerce checks passed.');
