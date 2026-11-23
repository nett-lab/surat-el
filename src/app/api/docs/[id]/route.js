import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request, { params }) {
  const { id } = await params;
  const mode = request.nextUrl.searchParams.get('mode') === 'inline' ? 'inline' : 'download';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Query lewat RLS client: otomatis memeriksa app.can_access_letter(letter_id) & tenant_id.
  const { data: doc } = await supabase
    .from('letter_docs')
    .select('id, name, path')
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan atau tidak memiliki akses.' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from('letter-docs')
    .createSignedUrl(doc.path, 60, mode === 'download' ? { download: doc.name } : undefined);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Gagal menyiapkan dokumen.' }, { status: 500 });
  }

  const response = NextResponse.redirect(signed.signedUrl, { status: 302 });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
