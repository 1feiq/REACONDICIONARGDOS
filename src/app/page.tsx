import Link from 'next/link';
import { Check, MapPin, ShieldCheck, Handshake, Recycle } from 'lucide-react';
import { Quote } from '@/components/quote';
import { DeviceCard } from '@/components/device-card';
import { getDevices, getCatalog } from '@/lib/data';
import { configured } from '@/lib/config';
import { AdPlacement } from '@/components/ad-placement';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const [devices, catalog] = await Promise.all([getDevices(), getCatalog()]);
  return (
    <>
      <section className="container hero">
        <div>
          <span className="eyebrow">
            <MapPin size={14} /> El marketplace gratuito de celulares para reparar
          </span>
          <h1>
            Se rompió.
            <br />
            <span>No se terminó.</span>
          </h1>
          <p className="intro">
            Ese equipo todavía tiene mucho para dar. Vendelo como está o encontrá un técnico de
            tu ciudad para volver a usarlo.
          </p>
          <div className="actions">
            <Link className="button" href="/publicar">
              Publicar mi equipo gratis
            </Link>
            <Link className="button secondary" href="/equipos">
              Explorar equipos
            </Link>
          </div>
          <div className="reassurance">
            <span>
              <Check size={15} /> Sin comisiones
            </span>
            <span>
              <Check size={15} /> Trato directo
            </span>
            <span>
              <Check size={15} /> Toda Argentina
            </span>
          </div>
        </div>
        <Quote catalog={catalog} demo={!configured()} />
      </section>
      <div className="strip">
        <div className="container strip-inner">
          <div className="strip-item">
            <MapPin size={25} />
            <div>
              Cerca tuyo<small>Personas y técnicos de Argentina</small>
            </div>
          </div>
          <div className="strip-item">
            <Handshake size={25} />
            <div>
              Vos elegís la propuesta<small>Acordá todo directamente</small>
            </div>
          </div>
          <div className="strip-item">
            <Recycle size={25} />
            <div>
              Menos descarte, más valor<small>Una segunda oportunidad para tu equipo</small>
            </div>
          </div>
        </div>
      </div>
      <section className="section soft">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">El próximo arreglo empieza acá</span>
              <h2>Equipos buscando otra oportunidad.</h2>
              <p>Celulares, notebooks y consolas. En toda Argentina.</p>
            </div>
            <Link className="text-link" href="/equipos">
              Ver todos los equipos
            </Link>
          </div>
          <div className="device-grid">
            {devices.slice(0, 3).map((d) => (
              <DeviceCard key={d.id} device={d} />
            ))}
          </div>
          {!devices.length && (
            <div className="empty">
              <h3>La primera oportunidad puede ser la tuya.</h3>
              <p>Publicá ese equipo que tenés guardado.</p>
              <Link className="button" href="/publicar">
                Publicar gratis
              </Link>
            </div>
          )}
        </div>
      </section>
      <AdPlacement placement="home" eligible={devices.every(d=>d.ad_eligible)} />
      <section className="section container">
        <span className="eyebrow">Simple, de principio a fin</span>
        <h2>Tu equipo, tus opciones.</h2>
        <div className="steps">
          <div>
            <span className="step-number">01 / CONTANOS QUÉ PASÓ</span>
            <h3>Publicá en unos minutos.</h3>
            <p>
              Subí fotos, contá la falla y elegí si querés vender, reparar o escuchar ambas
              opciones.
            </p>
          </div>
          <div>
            <span className="step-number">02 / CONECTÁ CON OTRAS PERSONAS</span>
            <h3>Recibí propuestas locales.</h3>
            <p>
              Las personas registradas pueden contactarte para evaluar el equipo y hacerte una
              propuesta.
            </p>
          </div>
          <div>
            <span className="step-number">03 / DECIDÍ CON TRANQUILIDAD</span>
            <h3>Elegí qué te conviene.</h3>
            <p>
              Acordá el precio y la entrega directamente. Publicar es gratis y no cobramos comisión.
            </p>
          </div>
        </div>
      </section>
      <section className="container" style={{ paddingBottom: 65 }}>
        <div className="tech-banner">
          <div>
            <span className="eyebrow" style={{ color: 'var(--lime)' }}>
              <ShieldCheck size={15} /> Para quienes saben reparar
            </span>
            <h2>
              Tu próximo trabajo
              <br />
              puede estar a unas cuadras.
            </h2>
            <p>
              Accedé a los contactos de equipos publicados en Argentina. Buscá reparaciones o equipos
              para reacondicionar.
            </p>
          </div>
          <div className="tech-price"><strong>Gratis para todos</strong><p>Publicá, conversá y recibí ofertas sin pagar comisiones.</p><Link className="button lime" href="/equipos">Encontrar equipos</Link></div>
        </div>
      </section>
    </>
  );
}
