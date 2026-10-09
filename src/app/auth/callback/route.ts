import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = process.env.APP_URL ?? url.origin;
  const client = await db();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/cuenta', origin));
  }
  return NextResponse.redirect(new URL('/ingresar?error=enlace', origin));
}
