import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitBranch, StickyNote } from 'lucide-react';
import { requirePermission, hasPermission } from '@/lib/auth/session';
import { getFlowDetail } from '@/lib/data/letters';
import { PageHeader, Button } from '@/components/ui/primitives';
import { LetterDetailView } from '@/components/letter/LetterDetailView';

export const metadata = { title: 'Detail Surat Masuk Utama' };

export default async function InboxPrimaryShowPage({ params }) {
  const ctx = await requirePermission('primary.show');
  const { flowId } = await params;

  const data = await getFlowDetail(flowId, {
    positionId: ctx.position?.id,
    expectedKind: 'distribution',
    expectedCategory: 'primary',
  });
  if (!data) notFound();

  const canFollowUp = data.letter.status === 'open';

  return (
    <div>
      <PageHeader
        title="Detail Surat Masuk Utama"
        actions={
          <Link href="/inbox/utama">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>
        }
      />
      <LetterDetailView
        letter={data.letter}
        flows={data.flows}
        docs={data.docs}
        activities={data.activities}
        actions={
          canFollowUp && (
            <>
              {hasPermission(ctx, 'disposition.create') && (
                <Link href={`/disposisi/baru?root=${data.flow.root_flow_id}&from=/inbox/utama/${data.flow.id}`}>
                  <Button size="sm">
                    <GitBranch className="h-4 w-4" />
                    Buat Disposisi
                  </Button>
                </Link>
              )}
              {hasPermission(ctx, 'memo.create') && (
                <Link href={`/nota-dinas/baru?root=${data.flow.root_flow_id}&from=/inbox/utama/${data.flow.id}`}>
                  <Button size="sm" variant="secondary">
                    <StickyNote className="h-4 w-4" />
                    Buat Nota Dinas
                  </Button>
                </Link>
              )}
            </>
          )
        }
      />
    </div>
  );
}
