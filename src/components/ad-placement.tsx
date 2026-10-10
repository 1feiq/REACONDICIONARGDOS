import {db} from '@/lib/supabase/server';
import {AdSlot} from './ad-slot';
import type {AdPlacementName} from '@/lib/advertising';
export async function AdPlacement({placement,eligible=true}:{placement:AdPlacementName;eligible?:boolean}){
 if(!eligible||process.env.NEXT_PUBLIC_ADSENSE_ENABLED!=='true'||process.env.NEXT_PUBLIC_CMP_READY!=='true'||process.env.NODE_ENV!=='production')return null;
 const client=await db();if(!client)return null;const {data,error}=await client.from('ad_settings').select('*').single();if(error||!data?.enabled||!data[placement])return null;
 const slots={home:process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT,search:process.env.NEXT_PUBLIC_ADSENSE_SEARCH_SLOT,device:process.env.NEXT_PUBLIC_ADSENSE_DEVICE_SLOT,guides:process.env.NEXT_PUBLIC_ADSENSE_GUIDES_SLOT};
 return <AdSlot client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID??''} slot={slots[placement]??''}/>;
}

