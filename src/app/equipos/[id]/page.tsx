import Link from 'next/link';
import { MarketForm } from '@/components/market-form';
import { AdPlacement } from '@/components/ad-placement';
import { DeviceSafety } from '@/components/device-safety';
import { notFound } from 'next/navigation';
import { Lock, MapPin, MessageCircle, Mail } from 'lucide-react';
import { getDevice } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { faults, intents } from '@/lib/config';
import { DeviceVisual } from '@/components/device-card';
import { ContactReveal } from '@/components/contact-reveal';
export const dynamic = 'force-dynamic';
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await getDevice(id);
  if (!device) notFound();
  return (
    <div className="container page-shell">
      <Link className="back" href="/equipos">
        Volver a los equipos
      </Link>
      <div className="detail">
        <div>
          <DeviceVisual device={device} />
          {device.photo_paths.length > 1 && (
            <div className="photos" style={{ marginTop: 15 }}>
              {device.photo_paths.slice(1).map((p) => (
                <a key={p} href={p} target="_blank" rel="noreferrer">
                  <img src={p} alt="Otra vista del equipo" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="eyebrow">
            <MapPin size={14} />
            {device.city} · {device.province} · {device.neighborhood}
          </span>
          <h1>
            {device.brand} {device.model}
          </h1>
          <span className="badge green">{intents[device.intent]}</span>
          <h3 style={{ marginTop: 25 }}>{faults[device.fault_code as keyof typeof faults]}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{device.description}</p>
          <DeviceSafety id={id} owner={device.owner_id} />
          <MarketForm id={id} action="conversation" label="Chatear y enviar una oferta gratis"/>
          <MarketForm id={id} action="favorite" label="Guardar favorito"/>
          <ContactReveal id={id}/>
        </div>
      </div>
      <AdPlacement placement="device" eligible={device.ad_eligible===true&&device.moderation_status==='approved'&&device.status==='publicado'}/>
    </div>
  );
}

export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const d=await getDevice(id);if(!d)return {title:'Publicación no disponible',robots:{index:false,follow:false}};return {title:d.brand+' '+d.model+' en '+d.city,description:d.description.slice(0,155),alternates:{canonical:'/equipos/'+d.id},robots:{index:d.status==='publicado'&&d.moderation_status==='approved',follow:true},openGraph:{title:d.brand+' '+d.model,description:d.description.slice(0,155),images:d.photo_paths.slice(0,1)}};}
