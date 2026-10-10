import 'server-only';
import { db } from './supabase/server';
import type { Device, Catalog } from './types';
import { redirect, notFound } from 'next/navigation';
export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile) redirect('/ingresar');
  if (profile.role !== 'admin') notFound();
  return profile;
}
function photoUrls(device: Device): Device {
  return {
    ...device,
    photo_paths: device.photo_paths.map(
      (p) =>
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/device-photos/${p.split('/').map(encodeURIComponent).join('/')}`,
    ),
  };
}
export async function getDevices(): Promise<Device[]> {
  const client = await db();
  if (!client) return [];
  const { data, error } = await client
    .from('devices')
    .select('*,device_specs(asking_price)')
    .eq('status', 'publicado')
    .eq('moderation_status','approved')
    .order('created_at', { ascending: false })
    .limit(90);
  if (error) throw new Error('No pudimos cargar los equipos. Intentá nuevamente.');
  return (data ?? []).map(photoUrls);
}
export async function getCatalog(): Promise<Catalog[]> {
  const client = await db();
  if (!client) return [];
  const { data, error } = await client
    .from('pricing_catalog')
    .select('*')
    .eq('is_active', true)
    .order('model');
  if (error) throw new Error('No pudimos cargar el cotizador.');
  return data ?? [];
}
export async function getProfile() {
  const client = await db();
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('users')
    .select('id,display_name,role,city,province,verification_status')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return { ...data, email: user.email };
}
export async function getDevice(id: string): Promise<Device | null> {
  const client = await db();
  if (!client) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await client.from('devices').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('No pudimos consultar el equipo.');
  return data ? photoUrls(data) : null;
}
