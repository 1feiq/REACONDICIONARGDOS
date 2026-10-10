'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/supabase/server';
import type {ActionState} from '@/lib/types';
export async function marketplaceAction(_:ActionState,form:FormData):Promise<ActionState>{
 const client=await db();if(!client || !(await client.auth.getUser()).data.user)return {error:'Ingresá a tu cuenta para continuar.'};
 const action=String(form.get('action'));const id=z.uuid().safeParse(form.get('id'));
 const detail=String(form.get('detail')??'');
 if(detail.length>2000)return {error:'El texto supera el límite permitido.'};
 if(!id.success && !['request_verification','profile','read_notifications','save_search'].includes(action))return {error:'Identificador inválido.'};
 const target=id.success?id.data:'00000000-0000-4000-8000-000000000000';
 let result;
 if(action==='conversation')result=await client.rpc('start_conversation',{p_device:target});
 else if(action==='message'){
 const request=z.uuid().safeParse(form.get('request_id'));if(!request.success)return {error:'Volvé a abrir el chat.'};
 result=await client.rpc('send_message',{p_conversation:target,p_body:detail,p_request:request.data});
 }else if(action==='offer')result=await client.rpc('make_offer',{p_conversation:target,p_amount:Number(form.get('amount'))});
 else if(['accepted','rejected','withdrawn'].includes(action))result=await client.rpc('answer_offer',{p_offer:target,p_answer:action});
 else if(action==='report')result=await client.rpc('report_listing',{p_device:target,p_reason:detail});
 else if(action==='request_verification')result=await client.rpc('request_verification');
 else if(action.startsWith('admin:'))result=await client.rpc('moderate_marketplace',{p_id:target,p_action:action.slice(6),p_reason:detail,p_enabled:form.get('enabled')==='on'});
 else {
 let filters={};if(action==='save_search'){try{filters=JSON.parse(String(form.get('filters')??'{}'));}catch{return {error:'Filtros inválidos.'};}}
 result=await client.rpc('market_action',{p_action:action,p_id:target,p_data:{reason:detail,body:detail,rating:Number(form.get('rating')),display_name:form.get('display_name'),city:form.get('city'),province:form.get('province'),name:form.get('name'),filters}});
 }
 if(result.error)return {error:'No se pudo registrar. Revisá el estado, tus permisos y los límites contra spam. Si ya guardaste esta acción, no hace falta repetirla.'};
 if(action==='conversation'&&result.data)redirect('/mensajes/'+result.data);
 for(const path of ['/cuenta','/mensajes','/favoritos','/admin','/admin/moderacion','/verificacion'])revalidatePath(path);
 if(id.success){revalidatePath('/mensajes/'+id.data);revalidatePath('/equipos/'+id.data);}
 return {success:'Guardado. Los acuerdos y pagos se realizan directamente entre las partes.'};
}

