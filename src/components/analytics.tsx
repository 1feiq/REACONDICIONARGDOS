'use client';
import Script from 'next/script';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
export function Analytics(){
 const path=usePathname(),[consent,setConsent]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{const read=()=>setConsent(window.reacondicionargdosConsent?.analytics===true);read();window.addEventListener('reacondicionargdos:consent',read);return()=>window.removeEventListener('reacondicionargdos:consent',read);},[]);
 const id=process.env.NEXT_PUBLIC_GA4_ID??'';
 const allowed=consent&&process.env.NEXT_PUBLIC_ANALYTICS_ENABLED==='true'&&process.env.NEXT_PUBLIC_CMP_READY==='true'&&process.env.NODE_ENV==='production'&&/^G-[A-Z0-9]+$/.test(id)&&typeof window!=='undefined'&&['reacondicionargdos.com','www.reacondicionargdos.com'].includes(window.location.hostname)&&(/^\/$|^\/equipos$|^\/equipos\/[0-9a-f-]{36}$|^\/guias(?:\/[^/]+)?$/.test(path));
 useEffect(()=>{if(allowed&&ready)window.gtag?.('event','page_view',{page_path:path,page_location:window.location.origin+path});},[allowed,ready,path]);
 if(!allowed)return null;
 return <Script id="official-ga4" src={'https://www.googletagmanager.com/gtag/js?id='+id} strategy="lazyOnload" onReady={()=>{window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer!.push(arguments);};window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.gtag('js',new Date());window.gtag('config',id,{send_page_view:false});setReady(true);}}/>;
}

