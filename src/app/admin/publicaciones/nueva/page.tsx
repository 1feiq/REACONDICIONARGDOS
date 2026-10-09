import { requireAdmin } from '@/lib/data';
import { DeviceForm } from '@/components/device-form';
import Link from 'next/link';
export default async function NewAdminDevice() {
  await requireAdmin();
  return (
    <div className="container narrow page-shell">
      <Link href="/admin" className="back">
        Volver a administración
      </Link>
      <div className="page-header">
        <span className="eyebrow">Carga manual</span>
        <h1>Una nueva oportunidad.</h1>
        <p>
          No hace falta crearle una cuenta al titular. Guardá un borrador o publicá con su
          autorización.
        </p>
      </div>
      <div className="panel">
        <DeviceForm admin />
      </div>
    </div>
  );
}
