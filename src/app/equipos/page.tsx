import { getDevices } from '@/lib/data';
import { Feed } from '@/components/feed';
export const dynamic = 'force-dynamic';
export default async function Devices() {
  const devices = await getDevices();
  return (
    <div className="container page-shell">
      <div className="page-header">
        <span className="eyebrow">Solo Rosario, Santa Fe</span>
        <h1>Encontrá tu próxima oportunidad.</h1>
        <p>
          Equipos para reparar, comprar y reacondicionar. El contacto se habilita con el Plan
          Técnico.
        </p>
      </div>
      <Feed devices={devices} />
    </div>
  );
}
