'use client';
import Script from 'next/script';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {adAllowed} from '@/lib/advertising';
declare global {interface Window {adsbygoogle?:Record<string,unknown>[];reacondicionargdosConsent?:{ads:boolean;analytics:boolean};dataLayer?:unknown[];gtag?:(...args:unknown[])=>void;}}
export function AdSlot({client,slot}:{client:string;slot:string}){
 const [consent,setConsent]=useState(false),[near,setNear]=useState(false),[loaded,setLoaded]=useState(false);
 const container=useRef<HTMLDivElement>(null),unit=useRef<HTMLElement>(null),pushed=useRef(false);
 const path=usePathname();
 useEffect(()=>{const read=()=>setConsent(window.reacondicionargdosConsent?.ads===true);read();window.addEventListener('reacondicionargdos:consent',read);return()=>window.removeEventListener('reacondicionargdos:consent',read);},[]);
 useEffect(()=>{if(!container.current)return;const obs=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setNear(true);},{rootMargin:'200px'});obs.observe(container.current);return()=>obs.disconnect();},[consent]);
 const allowed=typeof window!=='undefined'&&adAllowed({enabled:process.env.NEXT_PUBLIC_ADSENSE_ENABLED==='true'&&process.env.NEXT_PUBLIC_CMP_READY==='true',production:process.env.NODE_ENV==='production',host:window.location.hostname,client,slot,consent,moderated:true});
 useEffect(()=>{if(allowed&&near&&loaded&&unit.current&&!pushed.current){pushed.current=true;try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch{/* Ad blockers leave the reserved area empty. */}}},[allowed,near,loaded,path]);
 if(!allowed)return null;
 return <aside aria-label="Publicidad" className="ad-placement" ref={container}><small>Publicidad</small>{near&&<><Script id="official-adsense" src={'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+client} strategy="lazyOnload" crossOrigin="anonymous" onReady={()=>setLoaded(true)}/><ins ref={unit} className="adsbygoogle" style={{display:'block'}} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true"/></>}</aside>;
}

