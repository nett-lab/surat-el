import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button } from '@/components/ui/primitives';
import { CloseLetterForm } from './CloseLetterForm';

export const metadata = { title: 'Penutupan Surat' };

export default async function MemoClosePage({ params }) {
  const ctx = await requirePermission('memo.close');
  const { flowId } = await params;

  const supabase = await createClient();
  const { data: memo } = await supabase
    .from('letter_flows')
    .select('id, from_position_id, to_position_id, is_cc, letter:letters!inner (id, agenda, subject, status)')
    .eq('id', flowId)
    .eq('kind', 'memo')
    .is('deleted_at', null)
    .maybeSingle();

  if (
    !memo ||
    memo.is_cc ||
    memo.to_position_id !== ctx.position?.id ||
    memo.letter?.status !== 'open'
  ) {
    notFound();
  }

  const { data: positions } = await supabase
    .from('positions')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  return (
    <div>
      <PageHeader
        title="Penutupan Surat"
        description="Setelah ditutup, surat akan berpindah ke Arsip (baca-saja) dan tidak dapat diubah lagi."
        actions={
          <Link href={`/nota-dinas/${memo.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>
        }
      />
      <CloseLetterForm
        memoFlowId={memo.id}
        defaultToPositionId={memo.from_position_id}
        positions={positions || []}
        letter={memo.letter}
      />
    </div>
  );
}
