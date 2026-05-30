import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from './config';
import { createSupabaseServerClient, createSupabaseServiceClient } from './supabase/server';

export type AdminRole = 'super_admin' | 'admin' | 'editor';

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getAdminRole(userId: string): Promise<AdminRole | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('role,status')
    .eq('user_id', userId)
    .single();
  if (error || !data || data.status !== 'approved') return null;
  if (data.role === 'super_admin' || data.role === 'admin' || data.role === 'editor') return data.role;
  return null;
}

export async function requireAdmin(locale: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/admin/login`);
  const role = await getAdminRole(user.id);
  if (!role) redirect(`/${locale}/admin/login?error=not-authorized`);
  return { user, role };
}
