import { getProfile } from '@/lib/data';
import { redirect, notFound } from 'next/navigation';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect('/ingresar');
  if (profile.role !== 'admin') notFound();
  return children;
}
