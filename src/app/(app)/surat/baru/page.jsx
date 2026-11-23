import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card, CardContent } from '@/components/ui/primitives';
import { ComposeForm } from './ComposeForm';

export const metadata = { title: 'Catat Surat Masuk' };

export default async function ComposePage() {
  const ctx = await requirePermission('compose.create');
  const supabase = await createClient();

  const [{ data: classifications }, { data: positions }] = await Promise.all([
    supabase
      .from('classifications')
      .select('id, code, name')
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('positions')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ]);

  return (
    <div>
      <PageHeader
        title="Catat & Kirim Surat Masuk"
        description="Nomor agenda akan dibuat otomatis berdasarkan kode klasifikasi dan tahun."
      />
      {!ctx.position ? (
        <Card>
          <CardContent className="text-sm text-amber-800 dark:text-amber-300">
            Anda belum memiliki jabatan aktif. Minta admin instansi menetapkan jabatan Anda terlebih dahulu.
          </CardContent>
        </Card>
      ) : (
        <ComposeForm classifications={classifications || []} positions={positions || []} />
      )}
    </div>
  );
}
