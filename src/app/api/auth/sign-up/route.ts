import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: 'Production Supabase credentials are required for sign-up.' }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body.password || body.password.length < 8) {
    return NextResponse.json({ message: 'A valid email and password of at least 8 characters are required.' }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email: body.email, password: body.password });
  if (error) return NextResponse.json({ message: 'Sign-up failed. Please try again.' }, { status: 400 });
  return NextResponse.json({ message: 'Account created. Admin approval may still be required.' });
}
