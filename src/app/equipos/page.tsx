import Link from 'next/link';
import {DeviceCard} from '@/components/device-card';
import {categories,faults,provinces} from '@/lib/config';
import {normalizeSearch,searchUrl} from '@/lib/search';
import {searchDevices} from '@/lib/search-data';
import {MarketForm} from '@/components/market-form';
import {AdPlacement} from '@/components/ad-placement';
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string>>}){const p=await searchParams;return {title:'Celulares y equipos para reparar en Argentina',description:'Buscá equipos por marca, modelo, falla, provincia y precio. Contacto y ofertas gratuitos.',alternates:{canonical:'/equipos'},robots:{index:!Object.keys(p).length,follow:true}};}
export default async function Devices({searchParams}:{searchParams:Promise<Record<string,string>>}){
 const f=normalizeSearch(await searchParams);const {devices,count}=await searchDevices(f);
 return <div className="container page-shell"><div className="page-header"><span className="eyebrow">Toda Argentina · Contacto gratuito</span><h1>Encontrá tu próxima oportunidad.</h1><p>Filtrá equipos y acordá precio y entrega directamente.</p></div>
 <form action="/equipos" className="panel form-grid">
 <label className="field">Marca o modelo<input name="q" defaultValue={f.q} maxLength={100}/></label>
 <label className="field">Categoría<select name="category" defaultValue={f.category}><option value="">Todas</option>{Object.entries(categories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label className="field">Falla<select name="fault" defaultValue={f.fault}><option value="">Todas</option>{Object.entries(faults).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label className="field">Provincia<select name="province" defaultValue={f.province}><option value="">Todas</option>{provinces.map(p=><option key={p}>{p}</option>)}</select></label>
 <label className="field">Ciudad<input name="city" defaultValue={f.city} maxLength={80}/></label>
 <label className="field">Precio mínimo ARS<input name="min" type="number" min="0" defaultValue={f.min||''}/></label>
 <label className="field">Precio máximo ARS<input name="max" type="number" min="0" defaultValue={f.max||''}/></label>
 <button className="button">Buscar equipos</button><Link href="/equipos">Limpiar filtros</Link>
 </form><p>{count} publicaciones encontradas. Página {f.page}.</p>
 <div className="device-grid">{devices.slice(0,12).map(d=><DeviceCard key={d.id} device={d}/>)}</div>
 {devices.length>=12&&<AdPlacement placement="search" eligible={devices.every(d=>d.ad_eligible)}/>}
 <div className="device-grid">{devices.slice(12).map(d=><DeviceCard key={d.id} device={d}/>)}</div>
 {!devices.length&&<div className="empty">No hay publicaciones con estos filtros.</div>}
 <nav aria-label="Paginación" className="actions">{f.page>1&&<Link className="button secondary" href={searchUrl({...f,page:f.page-1})}>Anterior</Link>}{f.page*24<count&&<Link className="button secondary" href={searchUrl({...f,page:f.page+1})}>Siguiente</Link>}</nav>
 <details><summary>Guardar esta búsqueda y consultar novedades</summary><MarketForm action="save_search" label="Guardar búsqueda"><input name="filters" value={JSON.stringify({...f,page:1})} type="hidden"/><label className="field">Nombre<input name="name" required maxLength={100}/></label></MarketForm></details>
 </div>;
}

