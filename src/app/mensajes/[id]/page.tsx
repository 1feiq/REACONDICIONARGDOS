import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
import {db} from '@/lib/supabase/server';
import {getProfile} from '@/lib/data';
import {MarketForm} from '@/components/market-form';
import {money} from '@/lib/config';
export const metadata={title:'Conversación privada',robots:{index:false,follow:false}};
export default async function Conversation({params}:{params:Promise<{id:string}>}){
 const p=await getProfile();if(!p)redirect('/ingresar');const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const client=(await db())!;const {data:c}=await client.from('conversations').select('*').eq('id',id).maybeSingle();if(!c)notFound();
 const [messages,offers,deals]=await Promise.all([client.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).limit(100),client.from('offers').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).limit(50),client.from('direct_deals').select('*').eq('conversation_id',id)]);
 const other=p.id===c.buyer_id?c.seller_id:c.buyer_id;
 return <div className="container narrow page-shell"><h1>Conversación</h1><p><Link href={'/equipos/'+c.device_id}>Ver publicación</Link> · <Link href={'/perfiles/'+other}>Ver perfil</Link></p>
 <p>La plataforma no procesa pagos ni garantiza reembolsos. Revisá el dispositivo y la identidad de la otra parte antes de entregar dinero.</p>
 <a className="button secondary" href={'/mensajes/'+id}>Actualizar mensajes</a>
 <section aria-label="Últimos cien mensajes">{messages.error?<p role="alert">No pudimos cargar los mensajes.</p>:[...(messages.data??[])].reverse().map(m=><div className="notice" key={m.id}><strong>{m.sender_id===p.id?'Vos':'Otra persona'}</strong><p style={{whiteSpace:'pre-wrap'}}>{m.body}</p><small>{new Date(m.created_at).toLocaleString('es-AR')}</small></div>)}</section>
 <MarketForm key={messages.data?.[0]?.id??'new'} id={id} action="message" label="Enviar mensaje" text/>
 <h2>Ofertas</h2><MarketForm id={id} action="offer" label="Proponer precio"><label className="field">Importe en pesos<input name="amount" type="number" required min="1" max="999999999" step="0.01"/></label></MarketForm>
 {offers.data?.map(o=><section className="panel" key={o.id}><p>{o.author_id===p.id?'Tu propuesta':'Propuesta recibida'}: {money(Number(o.amount))} · {o.status}</p>{o.status==='pending'&&(o.author_id===p.id?<MarketForm id={o.id} action="withdrawn" label="Retirar oferta"/>:<><MarketForm id={o.id} action="accepted" label="Aceptar acuerdo (sin realizar pagos)"/><MarketForm id={o.id} action="rejected" label="Rechazar oferta"/></>)}</section>)}
 {deals.data?.map(d=><section className="panel" key={d.id}><h2>Acuerdo: {d.status}</h2><p>Confirmación comprador: {d.buyer_confirmed_at?'Registrada':'Pendiente'}. Confirmación vendedor: {d.seller_confirmed_at?'Registrada':'Pendiente'}.</p>
 {d.status==='agreed'&&<><MarketForm id={d.id} action="confirm_deal" label="Confirmar que concretamos la operación"/><MarketForm id={d.id} action="cancel_deal" label="Cancelar acuerdo"/></>}
 {d.status==='completed'&&<><p>Ambas partes confirmaron la operación. La plataforma no verificó el pago.</p><MarketForm id={d.id} action="review_deal" label="Valorar esta operación" text><label className="field">Puntuación<select name="rating">{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select></label></MarketForm><MarketForm id={d.id} action="challenge_review" label="Impugnar valoración recibida"/></>}</section>)}
 <details><summary>Seguridad de esta conversación</summary><MarketForm id={other} action="block" label="Bloquear nuevos contactos de esta persona"/><MarketForm id={other} action="unblock" label="Desbloquear"/><MarketForm id={other} action="report_user" label="Reportar usuario a administración" text/></details>
 </div>;
}

