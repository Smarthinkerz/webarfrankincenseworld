import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/config';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'ar-vision-studio',
    stack: 'nextjs-supabase',
    supabaseConfigured: isSupabaseConfigured(),
    timestamp: new Date().toISOString()
  });
}
