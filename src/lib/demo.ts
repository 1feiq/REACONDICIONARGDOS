import type { Device, Catalog } from './types';
// Preview fixtures only: never inserted as real leads or published market prices.
export const demoDevices: Device[] = [
  {
    id: 'ejemplo-iphone',
    category: 'celular',
    brand: 'Apple',
    model: 'iPhone 11',
    intent: 'vender',
    fault_code: 'pantalla_rota',
    description:
      'Ejemplo de una publicación: la pantalla está rota, el equipo enciende y responde al tacto. No es una oferta real.',
    photo_paths: [],
    neighborhood: 'Centro',
    created_at: '2026-10-08T15:00:00Z',
    status: 'publicado',
    source: 'demo',
  },
  {
    id: 'ejemplo-notebook',
    category: 'notebook',
    brand: 'Lenovo',
    model: 'IdeaPad 3',
    intent: 'reparar',
    fault_code: 'bateria',
    description:
      'Ejemplo de una publicación: funciona conectada, pero la batería ya no mantiene la carga. No es una oferta real.',
    photo_paths: [],
    neighborhood: 'Echesortu',
    created_at: '2026-10-08T15:00:00Z',
    status: 'publicado',
    source: 'demo',
  },
  {
    id: 'ejemplo-playstation',
    category: 'consola',
    brand: 'Sony',
    model: 'PlayStation 4',
    intent: 'ambas',
    fault_code: 'no_enciende',
    description:
      'Ejemplo de una publicación: la consola dejó de encender. Se consideran opciones de reparación y venta. No es una oferta real.',
    photo_paths: [],
    neighborhood: 'Pichincha',
    created_at: '2026-10-08T15:00:00Z',
    status: 'publicado',
    source: 'demo',
  },
];
export const demoCatalog: Catalog[] = [
  {
    id: 'demo-1',
    brand: 'Apple',
    model: 'iPhone 11',
    category: 'celular',
    fault_code: 'pantalla_rota',
    repair_min_ars: 65000,
    repair_max_ars: 95000,
    resale_broken_min_ars: 100000,
    resale_broken_max_ars: 160000,
    resale_repaired_min_ars: 220000,
    resale_repaired_max_ars: 280000,
    assumptions:
      'Ejemplo ilustrativo, no constituye una referencia de mercado. Equipo encendido y sin otras fallas.',
    updated_at: '2026-10-08T15:00:00Z',
    is_active: true,
  },
];
