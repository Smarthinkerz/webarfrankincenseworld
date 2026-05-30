-- AR Vision Studio campaign registry for public scan routes.
-- This migration intentionally stays on the existing Supabase stack and does not introduce Firebase.

create extension if not exists pgcrypto;

create table if not exists public.ar_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  headline text,
  instructions text,
  target_label text,
  target_image_url text not null,
  target_image_alt text,
  tracking_dataset_url text,
  tracking_mode text not null default 'image-target' check (tracking_mode in ('image-target', 'manual-preview')),
  video_url text,
  video_poster_url text,
  video_title text,
  playback_mode text not null default 'autoplay_on_detect' check (playback_mode in ('autoplay_on_detect', 'tap_to_play', 'autoplay-on-detect', 'tap-to-play')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ar_campaigns_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists ar_campaigns_slug_key on public.ar_campaigns (slug);
create index if not exists ar_campaigns_status_slug_idx on public.ar_campaigns (status, slug);

create or replace function public.set_ar_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.status = 'published' and old.status is distinct from 'published' and new.published_at is null then
    new.published_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_ar_campaigns_updated_at on public.ar_campaigns;
create trigger set_ar_campaigns_updated_at
before update on public.ar_campaigns
for each row execute function public.set_ar_campaigns_updated_at();

alter table public.ar_campaigns enable row level security;

-- Public visitors can only read published campaigns used by /scan/[slug].
drop policy if exists "Public can read published AR campaigns" on public.ar_campaigns;
create policy "Public can read published AR campaigns"
  on public.ar_campaigns for select
  using (status = 'published');

-- Approved admins can manage draft, published, and archived campaigns through the private CMS.
drop policy if exists "Approved admins can read all AR campaigns" on public.ar_campaigns;
create policy "Approved admins can read all AR campaigns"
  on public.ar_campaigns for select
  using (public.is_approved_admin(auth.uid()));

drop policy if exists "Approved admins can insert AR campaigns" on public.ar_campaigns;
create policy "Approved admins can insert AR campaigns"
  on public.ar_campaigns for insert
  with check (public.is_approved_admin(auth.uid()));

drop policy if exists "Approved admins can update AR campaigns" on public.ar_campaigns;
create policy "Approved admins can update AR campaigns"
  on public.ar_campaigns for update
  using (public.is_approved_admin(auth.uid()))
  with check (public.is_approved_admin(auth.uid()));

drop policy if exists "Approved admins can delete AR campaigns" on public.ar_campaigns;
create policy "Approved admins can delete AR campaigns"
  on public.ar_campaigns for delete
  using (public.is_approved_admin(auth.uid()));

-- Optional seed for the first production campaign. The tracking URL points at the expected
-- Supabase Storage object path; the Next.js scanner also has a bundled local fallback for preview.
insert into public.ar_campaigns (
  name,
  slug,
  status,
  headline,
  instructions,
  target_label,
  target_image_url,
  target_image_alt,
  tracking_dataset_url,
  tracking_mode,
  video_url,
  video_poster_url,
  video_title,
  playback_mode,
  created_by,
  published_at
)
values (
  'Purewells Wacandy Japan',
  'purewells-wacandy-japan',
  'published',
  'Scan the Purewells Wacandy Japan image target to unlock the campaign video experience.',
  'Open this page on a mobile device, tap Start camera, allow camera access, and point the camera at the printed Wacandy target image. The campaign video will appear over the target when it is detected.',
  'Purewells Wacandy Japan target: Owa Stamp EXPO',
  'https://sotwadzvuuqvzncmtjqg.supabase.co/storage/v1/object/public/ar-targets/Owa%20Stamp%20EXPO.png',
  'Purewells Wacandy Japan Owa Stamp EXPO image target',
  'https://sotwadzvuuqvzncmtjqg.supabase.co/storage/v1/object/public/ar-tracking/purewells-tracking.mind',
  'image-target',
  'https://sotwadzvuuqvzncmtjqg.supabase.co/storage/v1/object/public/ar-videos/purewells-video.mp4',
  null,
  'Purewells Wacandy Japan campaign video',
  'autoplay_on_detect',
  (select id from auth.users where id = '4f207900-6568-47f4-832e-32f7975cb3aa'::uuid),
  now()
)
on conflict (slug) do update set
  name = excluded.name,
  status = excluded.status,
  headline = excluded.headline,
  instructions = excluded.instructions,
  target_label = excluded.target_label,
  target_image_url = excluded.target_image_url,
  target_image_alt = excluded.target_image_alt,
  tracking_dataset_url = excluded.tracking_dataset_url,
  tracking_mode = excluded.tracking_mode,
  video_url = excluded.video_url,
  video_title = excluded.video_title,
  playback_mode = excluded.playback_mode,
  updated_at = now();
