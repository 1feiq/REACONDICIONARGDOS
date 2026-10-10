import { z } from 'zod';
import { provinces } from './config';
const optionalEmail = z.union([z.email().max(254), z.literal('')]);
export const deviceSchema = z
  .object({
    category: z.enum(['celular', 'notebook', 'consola']),
    brand: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(100),
    intent: z.enum(['vender', 'reparar', 'ambas']),
    fault_code: z.enum(['pantalla_rota', 'bateria', 'no_enciende', 'carga', 'otro']),
    description: z.string().trim().min(15, 'Contá la falla con al menos 15 caracteres.').max(2000),
    city: z.string().trim().min(2).max(80),
    province: z.enum(provinces),
    country_code:z.literal('AR'),
    neighborhood: z.string().max(80),
    contact_name: z.string().trim().min(2).max(100),
    whatsapp_e164: z.union([
      z
        .string()
        .regex(/^\+[1-9]\d{7,14}$/, 'Usá el formato internacional, por ejemplo +5493411234567.'),
      z.literal(''),
    ]),
    contact_email: optionalEmail,
    source_url: z.union([z.url().refine((s) => s.startsWith('https://')), z.literal('')]),
    permission: z.boolean(),
    status: z.enum(['publicado', 'borrador']),
    source: z.enum(['usuario', 'admin']),
  })
  .refine((d) => d.whatsapp_e164 || d.contact_email, {
    message: 'Ingresá WhatsApp o email de contacto.',
  })
  .refine((d) => d.status !== 'publicado' || d.permission, {
    message: 'Necesitamos la autorización para publicar el contacto.',
  })
  .refine(
    (d) =>
      !/(?:https?:\/\/|www\.|wa\.me|[\w.+-]+@[\w.-]+\.\w{2,}|(?:\+?\d[\s()-]*){8,})/i.test(
        `${d.brand} ${d.model} ${d.description} ${d.neighborhood}`,
      ),
    { message: 'No incluyas teléfonos, correos ni enlaces en los datos públicos.' },
  );
export const catalogSchema = z
  .object({
    category: z.enum(['celular', 'notebook', 'consola']),
    brand: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(100),
    fault_code: z.enum(['pantalla_rota', 'bateria', 'no_enciende', 'carga', 'otro']),
    repair_min_ars: z.coerce.number().min(0).max(999999999),
    repair_max_ars: z.coerce.number().min(0).max(999999999),
    resale_broken_min_ars: z.coerce.number().min(0).max(999999999),
    resale_broken_max_ars: z.coerce.number().min(0).max(999999999),
    resale_repaired_min_ars: z.coerce.number().min(0).max(999999999),
    resale_repaired_max_ars: z.coerce.number().min(0).max(999999999),
    assumptions: z.string().trim().min(10).max(1000),
  })
  .refine(
    (d) =>
      d.repair_max_ars >= d.repair_min_ars &&
      d.resale_broken_max_ars >= d.resale_broken_min_ars &&
      d.resale_repaired_max_ars >= d.resale_repaired_min_ars,
    { message: 'Cada máximo debe ser mayor o igual a su mínimo.' },
  );
export function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/cuenta';
}

export const deviceSpecsSchema = z
  .object({
    storage_capacity: z.string().trim().min(1).max(40),
    physical_condition: z.string().trim().min(1).max(500),
    power_on: z.enum(['si', 'no', 'desconocido']),
    screen: z.string().trim().min(1).max(300),
    battery: z.string().trim().min(1).max(300),
    motherboard: z.string().trim().min(1).max(300),
    activation_lock: z.enum(['libre', 'bloqueado', 'desconocido']),
    previous_repairs: z.string().trim().min(1).max(500),
    asking_price: z.union([z.literal(''), z.coerce.number().positive().max(999999999)]),
    accepts_offers: z.boolean(),
    delivery: z.enum(['presencial', 'envio', 'ambas']),
  })
  .refine(
    (d) =>
      !/(?:https?:\/\/|www\.|wa\.me|[\w.+-]+@[\w.-]+\.\w{2,}|(?:\+?\d[\s()-]*){8,})/i.test(
        [
          d.storage_capacity,
          d.physical_condition,
          d.screen,
          d.battery,
          d.motherboard,
          d.previous_repairs,
        ].join(' '),
      ),
    { message: 'No incluyas contactos ni identificadores en los campos públicos.' },
  );
