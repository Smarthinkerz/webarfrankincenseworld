import { NextResponse } from 'next/server';
import { getAdminRole, getCurrentUser } from '@/lib/auth';
import type { CmsPayload } from '@/lib/cms-schema';
import { upsertCmsPayload } from '@/lib/cms-store';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Admin sign-in is required before saving drafts.' }, { status: 401 });
  const role = await getAdminRole(user.id);
  if (!role) return NextResponse.json({ message: 'Your account is not approved for CMS access.' }, { status: 403 });
  const payload = await request.json().catch(() => null) as CmsPayload | null;
  if (!payload?.locale || !payload.content) return NextResponse.json({ message: 'Invalid CMS payload.' }, { status: 400 });
  const result = await upsertCmsPayload({ ...payload, publicationStatus: 'draft' }, user.id);
  return NextResponse.json({ message: result.message }, { status: result.status });
}
