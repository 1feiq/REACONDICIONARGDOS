'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Calculator, Sparkles } from 'lucide-react';
import { faults, money } from '@/lib/config';
import type { Catalog } from '@/lib/types';
export function Quote({ catalog, demo }: { catalog: Catalog[]; demo: boolean }) {
  const models = [...new Set(catalog.map((c) => `${c.brand} ${c.model}`))];
  const [model, setModel] = useState(models[0] ?? '');
  const [fault, setFault] = useState('pantalla_rota');
  const [show, setShow] = useState(false);
  const result = catalog.find((c) => `${c.brand} ${c.model}` === model && c.fault_code === fault);
  return (
    <div className="quote-card" id="cotizador">
      <div className="quote-head">
        <span className="icon-box">
          <Calculator size={23} />
        </span>
        <div>
          <h3>¿Cuánto vale una segunda vida?</h3>
          <p>Cotizá tu equipo en unos segundos.</p>
        </div>
      </div>
      <div className="quote-body">
        <label className="field">
          Tu equipo
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setShow(false);
            }}
          >
            {models.length ? (
              models.map((m) => <option key={m}>{m}</option>)
            ) : (
              <option value="">Catálogo en preparación</option>
            )}
          </select>
        </label>
        <label className="field">
          ¿Qué le pasó?
          <select
            value={fault}
            onChange={(e) => {
              setFault(e.target.value);
              setShow(false);
            }}
          >
            {Object.entries(faults).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="button full" onClick={() => setShow(true)}>
          <Sparkles size={17} /> Estimar reparación y reventa
        </button>
        {show && (
          <div className="quote-result" role="status">
            {result ? (
              <>
                <span>{demo ? 'Ejemplo de resultado' : 'Estimación orientativa'}</span>
                <div className="result-row">
                  <span>Reparación</span>
                  <strong>
                    {money(result.repair_min_ars)}–{money(result.repair_max_ars)}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Venta con falla</span>
                  <strong>
                    {money(result.resale_broken_min_ars)}–{money(result.resale_broken_max_ars)}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Reventa reparado</span>
                  <strong>
                    {money(result.resale_repaired_min_ars)}–{money(result.resale_repaired_max_ars)}
                  </strong>
                </div>
                <p>
                  {result.assumptions} Actualizado:{' '}
                  {new Date(result.updated_at).toLocaleDateString('es-AR', {
                    timeZone: 'America/Argentina/Buenos_Aires',
                  })}
                  .
                </p>
              </>
            ) : (
              <p>
                No tenemos una estimación para esta combinación. Podés publicar tu equipo y recibir
                propuestas reales.
              </p>
            )}
            <Link
              className="text-link"
              style={{ display: 'block', marginTop: 16 }}
              href={`/publicar?modelo=${encodeURIComponent(model)}&falla=${fault}`}
            >
              Publicá tu equipo ahora para recibir ofertas reales de técnicos locales.
            </Link>
          </div>
        )}
        <p className="quote-foot">
          Gratis, sin registrarte.{' '}
          {demo
            ? 'Valores ilustrativos de demostración.'
            : 'El diagnóstico final lo realiza un técnico.'}
        </p>
      </div>
    </div>
  );
}
