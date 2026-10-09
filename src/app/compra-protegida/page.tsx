import Link from 'next/link';
export default function Protection() {
  return (
    <div className="container page-shell">
      <div className="page-header">
        <span className="eyebrow">Seguridad para ambas partes</span>
        <h1>Compra Protegida</h1>
        <p>
          En preparación. Hoy las operaciones son directas entre particulares y no tienen cobertura
          de la plataforma.
        </p>
      </div>
      <section className="panel">
        <h2>Antes de habilitar pagos</h2>
        <p>
          Necesitamos un proveedor contratado que confirme la custodia o retención autorizada,
          permita gestionar disputas y confirme cada liberación o reembolso. No cobramos comisiones
          por una protección todavía no disponible.
        </p>
      </section>
      <div className="form-grid">
        {[
          '1. Revisá la descripción, fallas, bloqueo y precio total.',
          '2. Pagá únicamente cuando la integración de protección esté habilitada.',
          '3. El vendedor registra el equipo, embalaje y despacho de forma privada.',
          '4. Seguí los acontecimientos confirmados de la entrega.',
          '5. Inspeccioná el dispositivo y comunicá diferencias.',
          '6. El proveedor libera el dinero según las condiciones aceptadas.',
        ].map((t) => (
          <section className="panel" key={t}>
            <h3>{t}</h3>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Reclamos y protección del vendedor</h2>
        <p>
          Una propuesta inicial de revisión de 48 horas no limita derechos legales. Se evalúan las
          pruebas de ambas partes; no se rechazan reclamos automáticamente por falta de video, ni se
          conceden reembolsos automáticos por una acusación.
        </p>
        <p>
          Un video de embalaje no garantiza que no haya sustituciones. IMEI, fotos, descripción
          original, logística y devolución deben analizarse en conjunto.
        </p>
        <p>
          La cobertura, exclusiones, plazos, comisión e impuestos definitivos se informarán antes de
          contratar. La suscripción Pro es independiente.
        </p>
      </section>
      <Link className="button secondary" href="/operaciones">
        Mis operaciones y reclamos
      </Link>{' '}
      <Link href="/politicas">Políticas en preparación</Link>
    </div>
  );
}
