import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from './config';
import { createSupabaseServerClient } from './supabase/server';

export type AdminRole = 'super_admin' | 'admin' | 'editor';

const ALLOWED_ADMIN_ROLES = new Set<AdminRole>(['super_admin', 'admin', 'editor']);

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getAdminRole(userId: string): Promise<AdminRole | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user || user.id !== userId) return null;

  const { data, error } = await supabase
    .from('admin_profiles')
    .select('role,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== 'approved') return null;
  if (!ALLOWED_ADMIN_ROLES.has(data.role as AdminRole)) return null;

  return data.role as AdminRole;
}

export async function requireAdmin(locale: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/admin/login`);
  const role = await getAdminRole(user.id);
  if (!role) redirect(`/${locale}/admin/login?error=not-authorized`);
  return { user, role };
}
