import Link from 'next/link';
import { DeviceSafety } from '@/components/device-safety';
import { notFound } from 'next/navigation';
import { Lock, MapPin, MessageCircle, Mail } from 'lucide-react';
import { getDevice } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { faults, intents, money, MONTHLY_ARS } from '@/lib/config';
import { DeviceVisual } from '@/components/device-card';
import { ContactReveal } from '@/components/contact-reveal';
export const dynamic = 'force-dynamic';
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await getDevice(id);
  if (!device) notFound();
  const client = await db();
  let contact: {
    contact_name: string;
    whatsapp_e164: string | null;
    contact_email: string | null;
  } | null = null;
  if (client) {
    const { data } = await client
      .from('device_contacts')
      .select('contact_name,whatsapp_e164,contact_email')
      .eq('device_id', id)
      .maybeSingle();
    contact = data;
  }
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
            {device.neighborhood || 'Rosario'} · Rosario
          </span>
          <h1>
            {device.brand} {device.model}
          </h1>
          <span className="badge green">{intents[device.intent]}</span>
          <h3 style={{ marginTop: 25 }}>{faults[device.fault_code as keyof typeof faults]}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{device.description}</p>
          <DeviceSafety id={id} owner={device.owner_id} />
          {contact ? (
            <div className="contact-paywall">
              <h3>Contactá a {contact.contact_name}</h3>
              <p>Consultá el estado actual del equipo y acordá los detalles directamente.</p>
              <div className="actions">
                {contact.whatsapp_e164 && (
                  <a
                    className="button"
                    href={`https://wa.me/${contact.whatsapp_e164.replace('+', '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={17} />
                    WhatsApp
                  </a>
                )}
                {contact.contact_email && (
                  <a
                    className="button secondary"
                    href={`mailto:${encodeURIComponent(contact.contact_email)}`}
                  >
                    <Mail size={17} />
                    Email
                  </a>
                )}
              </div>
            </div>
          ) : device.source !== 'demo' ? (
            <ContactReveal id={id} />
          ) : (
            <div className="contact-paywall">
              <Lock size={26} />
              <h3>Una buena oportunidad empieza con un contacto.</h3>
              <p>
                {device.source === 'demo'
                  ? 'Esta publicación es un ejemplo; no tiene un contacto real.'
                  : 'Accedé al contacto con el Plan Técnico y conversá directamente con el dueño.'}
              </p>
              <Link className="button" href="/suscripcion">
                Ver Plan Técnico · {money(MONTHLY_ARS)}/mes
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
