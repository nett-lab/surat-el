import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, StickyNote, Archive } from 'lucide-react';
import { requirePermission, hasPermission } from '@/lib/auth/session';
import { getFlowDetail } from '@/lib/data/letters';
import { PageHeader, Button, Card, CardContent, Badge } from '@/components/ui/primitives';
import { LetterDetailView } from '@/components/letter/LetterDetailView';

export const metadata = { title: 'Detail Nota Dinas' };

export default async function MemoShowPage({ params }) {
  const ctx = await requirePermission('memo.show');
  const { flowId } = await params;

  const data = await getFlowDetail(flowId, {
    positionId: ctx.position?.id,
    expectedKind: 'memo',
  });
  if (!data) notFound();

  const canFollowUp = data.letter.status === 'open' && !data.flow.is_cc;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detail Nota Dinas"
        actions={
          <Link href="/nota-dinas">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-2 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
            <span>Dari: <strong className="text-[var(--fg)]">{data.flow.from_position?.name}</strong> ({data.flow.from_user?.name})</span>
            {data.flow.is_cc && <Badge>Tembusan (CC — hanya baca)</Badge>}
            {data.flow.is_closing && <Badge variant="success">Nota Penutupan</Badge>}
          </div>
          {data.flow.instruction && (
            <p className="text-sm text-[var(--fg)]">Catatan: {data.flow.instruction}</p>
          )}
        </CardContent>
      </Card>

      <LetterDetailView
        letter={data.letter}
        flows={data.flows}
        docs={data.docs}
        activities={data.activities}
        actions={
          canFollowUp && (
            <>
              {hasPermission(ctx, 'memo.create') && (
                <Link href={`/nota-dinas/baru?root=${data.flow.root_flow_id}&from=/nota-dinas`}>
                  <Button size="sm" variant="secondary">
                    <StickyNote className="h-4 w-4" />
                    Balas Nota Dinas
                  </Button>
                </Link>
              )}
              {hasPermission(ctx, 'memo.close') && (
                <Link href={`/nota-dinas/${data.flow.id}/tutup`}>
                  <Button size="sm">
                    <Archive className="h-4 w-4" />
                    Tutup & Arsipkan Surat
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
