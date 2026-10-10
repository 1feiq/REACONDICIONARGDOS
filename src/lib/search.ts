import {z} from 'zod';
export const searchSchema=z.object({q:z.string().max(100).default(''),category:z.enum(['','celular','notebook','consola']).default(''),fault:z.enum(['','pantalla_rota','bateria','no_enciende','carga','otro']).default(''),province:z.string().max(80).default(''),city:z.string().max(80).default(''),min:z.coerce.number().min(0).max(999999999).default(0),max:z.coerce.number().min(0).max(999999999).default(0),page:z.coerce.number().int().min(1).max(1000).default(1)});
export type SearchFilters=z.infer<typeof searchSchema>;
export function normalizeSearch(input:Record<string,unknown>):SearchFilters{const r=searchSchema.safeParse(input);return r.success?r.data:searchSchema.parse({});}
export function searchUrl(filters:Record<string,unknown>){const q=new URLSearchParams();for(const [k,v]of Object.entries(filters))if(v!==''&&v!==0&&v!=null)q.set(k,String(v));return '/equipos?'+q.toString();}
export function safeSearchText(text:string){return text.replace(/[^\p{L}\p{N}\s-]/gu,' ').trim();}

