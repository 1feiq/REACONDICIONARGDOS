import 'server-only';
import {db} from './supabase/server';
import {safeSearchText,type SearchFilters} from './search';
import type {Device} from './types';
export async function searchDevices(f:SearchFilters,after?:string){
 const c=await db();if(!c)return {devices:[] as Device[],count:0};
 let q=c.from('devices').select(f.min||f.max?'*,device_specs!inner(asking_price)':'*,device_specs(asking_price)',{count:'exact'}).eq('status','publicado').eq('moderation_status','approved');
 const term=safeSearchText(f.q);if(term)q=q.or('brand.ilike.%'+term+'%,model.ilike.%'+term+'%');
 if(f.category)q=q.eq('category',f.category);if(f.fault)q=q.eq('fault_code',f.fault);
 if(f.province)q=q.eq('province',f.province);if(f.city)q=q.ilike('city',safeSearchText(f.city));
 if(f.min)q=q.gte('device_specs.asking_price',f.min);if(f.max)q=q.lte('device_specs.asking_price',f.max);
 if(after)q=q.gt('published_at',after);
 const {data,error,count}=await q.order('published_at',{ascending:false}).order('id').range((f.page-1)*24,f.page*24-1);
 if(error)throw new Error('No pudimos cargar las publicaciones.');
 return {devices:(data??[]).map(d=>({...d,photo_paths:d.photo_paths.map((p:string)=>process.env.NEXT_PUBLIC_SUPABASE_URL+'/storage/v1/object/public/device-photos/'+p.split('/').map(encodeURIComponent).join('/'))})) as Device[],count:count??0};
}

