import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '@/lib/supabase/server';
import {getProfile} from '@/lib/data';
import {MarketForm} from '@/components/market-form';
export const metadata={title:'Favoritos',robots:{index:false,follow:false}};
export default async function Favorites(){
 if(!await getProfile())redirect('/ingresar');const c=(await db())!;const {data,error}=await c.from('favorites').select('device_id,devices(brand,model)').order('created_at',{ascending:false}).limit(500);
 return <div className="container page-shell"><h1>Tus favoritos</h1>{error?<p>No pudimos cargar tus favoritos.</p>:data?.length?data.map(f=><section className="panel" key={f.device_id}><Link href={'/equipos/'+f.device_id}>{(f.devices as unknown as {brand:string;model:string}|null)?.brand??'Publicación no disponible'} {(f.devices as unknown as {model:string}|null)?.model}</Link><MarketForm id={f.device_id} action="unfavorite" label="Quitar de favoritos"/></section>):<p>Todavía no guardaste equipos.</p>}</div>;
}

