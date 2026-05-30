import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: 'Production Supabase credentials are required for secure sign-in.' }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
  if (error) return NextResponse.json({ message: 'Sign-in failed. Check the credentials and admin approval status.' }, { status: 401 });
  return NextResponse.json({ message: 'Signed in.' });
}
