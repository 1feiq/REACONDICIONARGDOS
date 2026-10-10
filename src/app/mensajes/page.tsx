import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '@/lib/supabase/server';
import {getProfile} from '@/lib/data';
export const metadata={title:'Mensajes y ofertas',robots:{index:false,follow:false}};
export default async function Inbox(){
 const p=await getProfile();if(!p)redirect('/ingresar');const client=(await db())!;
 const {data,error}=await client.from('conversations').select('id,device_id,created_at').order('created_at',{ascending:false}).limit(100);
 return <div className="container page-shell"><h1>Mensajes y ofertas</h1><p>Conversaciones privadas, sin publicidad. No envíes documentos ni contraseñas. Acordá pago y entrega directamente.</p>
 {error?<p role="alert">No pudimos cargar las conversaciones.</p>:data?.length?data.map(c=><Link className="admin-row" key={c.id} href={'/mensajes/'+c.id}>Conversación sobre equipo {c.device_id.slice(0,8)} · {new Date(c.created_at).toLocaleDateString('es-AR')}</Link>):<div className="empty"><h2>Todavía no hay conversaciones.</h2><Link href="/equipos">Buscá un equipo y contactá a su vendedor.</Link></div>}
 </div>;
}

