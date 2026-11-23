import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const { data: targetPath, error } = await supabase.rpc('mark_notification_open', {
    p_notification_id: id,
  });

  const safePath =
    !error && typeof targetPath === 'string' && targetPath.startsWith('/')
      ? targetPath
      : '/notifikasi';

  return NextResponse.redirect(new URL(safePath, request.url));
}
