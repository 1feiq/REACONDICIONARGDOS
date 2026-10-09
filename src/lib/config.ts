export const BRAND = 'reacondicionargdos';
export const MONTHLY_ARS = 15000;
export const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
export const categories = {
  celular: 'Celulares',
  notebook: 'Notebooks',
  consola: 'Consolas',
} as const;
export const intents = {
  vender: 'Lo quiero vender',
  reparar: 'Lo quiero reparar',
  ambas: 'Escucho ambas opciones',
} as const;
export const faults = {
  pantalla_rota: 'Pantalla rota',
  bateria: 'Batería',
  no_enciende: 'No enciende',
  carga: 'Puerto de carga',
  otro: 'Otra falla',
} as const;
export const configured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
