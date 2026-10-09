import { requireAdmin } from '@/lib/data';
import Link from 'next/link';
import { CatalogForm } from '@/components/catalog-form';
import { getCatalog } from '@/lib/data';
import { faults, money } from '@/lib/config';
export default async function AdminPricing() {
  await requireAdmin();
  const catalog = await getCatalog();
  return (
    <div className="container narrow page-shell">
      <Link href="/admin" className="back">
        Volver a administración
      </Link>
      <div className="page-header">
        <span className="eyebrow">Cotizador</span>
        <h1>Valores de referencia.</h1>
        <p>
          Ingresá rangos verificados en Rosario. La misma combinación de marca, modelo y falla
          actualiza su registro.
        </p>
      </div>
      <div className="panel">
        <CatalogForm />
      </div>
      <h2>Catálogo activo</h2>
      {catalog.map((c) => (
        <div key={c.id} className="admin-row">
          <div>
            <h3>
              {c.brand} {c.model}
            </h3>
            <small>{faults[c.fault_code as keyof typeof faults]}</small>
          </div>
          <span>
            {money(c.repair_min_ars)}–{money(c.repair_max_ars)}
          </span>
        </div>
      ))}
      {!catalog.length && <p>Todavía no hay valores publicados.</p>}
    </div>
  );
}
