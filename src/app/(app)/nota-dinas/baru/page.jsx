import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button } from '@/components/ui/primitives';
import { FlowFormClient } from '@/components/letter/FlowFormClient';

export const metadata = { title: 'Buat Nota Dinas' };

export default async function MemoCreatePage({ searchParams }) {
  await requirePermission('memo.create');
  const params = await searchParams;
  const rootId = params?.root;
  if (!rootId) notFound();

  const supabase = await createClient();
  const { data: rootFlow } = await supabase
    .from('letter_flows')
    .select('id, letter:letters!inner (id, agenda, subject, status)')
    .eq('id', rootId)
    .eq('kind', 'distribution')
    .is('deleted_at', null)
    .maybeSingle();

  if (!rootFlow || rootFlow.letter?.status !== 'open') notFound();

  const { data: positions } = await supabase
    .from('positions')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  const redirectTo =
    typeof params?.from === 'string' && params.from.startsWith('/') ? params.from : '/nota-dinas';

  return (
    <div>
      <PageHeader
        title="Buat Nota Dinas Baru"
        description="Nota dinas dapat ditujukan ke jabatan aktif mana pun dalam instansi."
        actions={
          <Link href={redirectTo}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>
        }
      />
      <FlowFormClient
        kind="memo"
        rootFlowId={rootFlow.id}
        letter={rootFlow.letter}
        positions={positions || []}
        redirectTo={redirectTo}
      />
    </div>
  );
}
