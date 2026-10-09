import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase/server';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Confirmar ingreso',
  robots: { index: false, follow: false },
};

export default async function ConfirmLogin({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; code?: string }>;
}) {
  const { token_hash, code } = await searchParams;
  // Preserve the default Supabase template flow until custom SMTP is configured.
  if (!token_hash && code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  if (!token_hash || !/^[a-zA-Z0-9_-]{20,256}$/.test(token_hash))
    redirect('/ingresar?error=enlace');
  async function confirm(form: FormData) {
    'use server';
    const token = form.get('token_hash');
    const client = await db();
    if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{20,256}$/.test(token) || !client)
      redirect('/ingresar?error=enlace');
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'email' });
    redirect(error ? '/ingresar?error=enlace' : '/cuenta');
  }
  // A GET (including an email security scanner) must not consume the one-time token.
  return (
    <div className="container narrow section">
      <h1>Confirmá tu ingreso</h1>
      <p>Ingresarás en este navegador. Podés abrir el enlace desde otro dispositivo.</p>
      <form action={confirm}>
        <input type="hidden" name="token_hash" value={token_hash} />
        <button className="button">Ingresar a mi cuenta</button>
      </form>
    </div>
  );
}
