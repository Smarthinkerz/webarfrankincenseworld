-- AR Vision Studio admin CMS and live-preview persistence model.
-- Supabase-only: no Firebase dependencies or tables.

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'editor')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  locale text not null check (locale in ('en', 'ja', 'ar')),
  publication_status text not null check (publication_status in ('draft', 'published')),
  content jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_key, locale, publication_status)
);

alter table public.admin_profiles enable row level security;
alter table public.cms_pages enable row level security;

create or replace function public.is_approved_admin(required_roles text[] default array['super_admin','admin','editor'])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles profile
    where profile.user_id = auth.uid()
      and profile.status = 'approved'
      and profile.role = any(required_roles)
  );
$$;

drop policy if exists "Admins can view admin profiles" on public.admin_profiles;
create policy "Admins can view admin profiles" on public.admin_profiles
for select to authenticated
using (public.is_approved_admin(array['super_admin','admin']));

drop policy if exists "Super admins manage admin profiles" on public.admin_profiles;
create policy "Super admins manage admin profiles" on public.admin_profiles
for all to authenticated
using (public.is_approved_admin(array['super_admin']))
with check (public.is_approved_admin(array['super_admin']));

drop policy if exists "Published CMS pages are public readable" on public.cms_pages;
create policy "Published CMS pages are public readable" on public.cms_pages
for select to anon, authenticated
using (publication_status = 'published');

drop policy if exists "Approved admins can read all CMS pages" on public.cms_pages;
create policy "Approved admins can read all CMS pages" on public.cms_pages
for select to authenticated
using (public.is_approved_admin());

drop policy if exists "Approved admins can draft CMS pages" on public.cms_pages;
create policy "Approved admins can draft CMS pages" on public.cms_pages
for insert to authenticated
with check (public.is_approved_admin());

drop policy if exists "Approved admins can update CMS pages" on public.cms_pages;
create policy "Approved admins can update CMS pages" on public.cms_pages
for update to authenticated
using (public.is_approved_admin())
with check (public.is_approved_admin());
