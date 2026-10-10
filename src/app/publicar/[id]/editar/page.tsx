import {redirect,notFound} from 'next/navigation';
import {getProfile} from '@/lib/data';
import {db} from '@/lib/supabase/server';
import {DeviceForm} from '@/components/device-form';
export const metadata={title:'Editar publicación',robots:{index:false,follow:false}};
export default async function Edit({params}:{params:Promise<{id:string}>}){
 const profile=await getProfile();if(!profile)redirect('/ingresar');const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const c=(await db())!;const {data:d}=await c.from('devices').select('*').eq('id',id).eq('owner_id',profile.id).maybeSingle();if(!d)notFound();
 const [{data:s},{data:contact},{data:identifier}]=await Promise.all([c.from('device_specs').select('*').eq('device_id',id).maybeSingle(),c.from('device_contacts').select('contact_name,whatsapp_e164,contact_email').eq('device_id',id).maybeSingle(),c.from('device_identifiers').select('identifier,kind').eq('device_id',id).maybeSingle()]);
 const initial:Record<string,string>={};for(const [k,v]of Object.entries({...d,...s,...contact,identifier:identifier?.identifier,identifier_kind:identifier?.kind}))if(v!=null&&!Array.isArray(v))initial[k]=String(v);
 initial.photos=JSON.stringify(d.photo_paths);initial.id=id;
 return <div className="container narrow page-shell"><h1>Editar publicación</h1><p>Al guardar, el contenido vuelve a revisión. Las conversaciones previas se conservan.</p><DeviceForm initial={initial}/></div>;
}
