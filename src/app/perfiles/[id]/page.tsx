import {notFound} from 'next/navigation';
import {db} from '@/lib/supabase/server';
import {verificationLabels} from '@/lib/commerce';
import {MarketForm} from '@/components/market-form';
export const metadata={title:'Perfil público',robots:{index:false,follow:false}};
export default async function Profile({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();const c=await db();const r=c?await c.rpc('public_reputation',{p_user:id}):null;const p=r?.data;if(!p)notFound();
 return <div className="container narrow page-shell"><h1>{p.name}</h1><p>{verificationLabels[p.verification]} · Cuenta desde {new Date(p.joined).toLocaleDateString('es-AR')}</p><section className="panel"><h2>Reputación</h2><p>Ventas confirmadas por ambas partes: {p.sales}. Compras: {p.purchases}.</p><p>Valoración como vendedor: {p.seller_rating??'Sin valoraciones'}. Como comprador: {p.buyer_rating??'Sin valoraciones'}.</p><p>Estas confirmaciones no verifican pagos, identidad ni ausencia de fraude. Las valoraciones impugnadas no se incluyen en el promedio.</p></section><MarketForm id={id} action="report_user" label="Reportar perfil" text/></div>;
}

