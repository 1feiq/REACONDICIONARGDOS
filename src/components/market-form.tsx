'use client';
import {useActionState,useState,type ReactNode} from 'react';
import {marketplaceAction} from '@/app/actions/marketplace';
export function MarketForm({id,action,label,children,text=false}:{id?:string;action:string;label:string;children?:ReactNode;text?:boolean}){
 const [state,submit,pending]=useActionState(marketplaceAction,{});
 const [request]=useState(()=>crypto.randomUUID());
 return <form action={submit} style={{marginBlock:16}}>
 <input type="hidden" name="id" value={id??''}/><input type="hidden" name="action" value={action}/><input type="hidden" name="request_id" value={request}/>
 {children}{text&&<label className="field">Detalle<textarea name="detail" required minLength={action==='message'?1:15} maxLength={2000}/></label>}
 <button className="button secondary" disabled={pending||Boolean(state.success)}>{pending?'Guardando…':label}</button>
 {state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
 </form>;
}

