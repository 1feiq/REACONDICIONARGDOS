import Link from 'next/link';
import { Smartphone, Laptop, Gamepad2, Lock, MapPin, TriangleAlert } from 'lucide-react';
import { faults } from '@/lib/config';
import type { Device } from '@/lib/types';
export function DeviceVisual({ device }: { device: Device }) {
  const Icon =
    device.category === 'celular' ? Smartphone : device.category === 'notebook' ? Laptop : Gamepad2;
  return (
    <div className={`device-visual ${device.category}`}>
      {device.photo_paths[0] ? (
        <img src={device.photo_paths[0]} alt={`${device.brand} ${device.model}`} loading="lazy" />
      ) : (
        <Icon size={70} strokeWidth={1.15} />
      )}
      <span className="badge">
        {device.source === 'demo'
          ? 'Ejemplo'
          : device.intent === 'vender'
            ? 'En venta'
            : device.intent === 'reparar'
              ? 'Busca reparación'
              : 'Venta o reparación'}
      </span>
    </div>
  );
}
export function DeviceCard({ device }: { device: Device }) {
  return (
    <Link className="device-card" href={`/equipos/${device.id}`}>
      <DeviceVisual device={device} />
      <div className="device-body">
        <div className="device-meta">
          <span style={{ display: 'flex', gap: 4 }}>
            <MapPin size={13} />
            {device.neighborhood || 'Rosario'}
          </span>
          <span>{device.source === 'demo' ? 'Vista previa' : 'Rosario'}</span>
        </div>
        <h3>
          {device.brand} {device.model}
        </h3>
        <span className="fault-label">
          <TriangleAlert size={14} />
          {faults[device.fault_code as keyof typeof faults] ?? device.fault_code}
        </span>
        <div className="device-bottom">
          <span className="locked">
            <Lock size={14} /> Contacto exclusivo
          </span>
          <span className="text-link">Ver equipo</span>
        </div>
      </div>
    </Link>
  );
}
