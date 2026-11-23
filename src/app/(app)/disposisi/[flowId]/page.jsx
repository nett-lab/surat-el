import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitBranch, StickyNote } from 'lucide-react';
import { requirePermission, hasPermission } from '@/lib/auth/session';
import { getFlowDetail } from '@/lib/data/letters';
import { PageHeader, Button, Card, CardContent, Badge } from '@/components/ui/primitives';
import { LetterDetailView } from '@/components/letter/LetterDetailView';

export const metadata = { title: 'Detail Disposisi' };

export default async function DispositionShowPage({ params }) {
  const ctx = await requirePermission('disposition.show');
  const { flowId } = await params;

  const data = await getFlowDetail(flowId, {
    positionId: ctx.position?.id,
    expectedKind: 'disposition',
  });
  if (!data) notFound();

  const canFollowUp = data.letter.status === 'open' && !data.flow.is_cc;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detail Disposisi"
        actions={
          <Link href="/disposisi">
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
          </div>
          {Array.isArray(data.flow.followups) && data.flow.followups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.flow.followups.map((f) => (
                <Badge key={f} variant="warning">{f}</Badge>
              ))}
            </div>
          )}
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
              {hasPermission(ctx, 'disposition.create') && (
                <Link href={`/disposisi/baru?root=${data.flow.root_flow_id}&from=/disposisi`}>
                  <Button size="sm">
                    <GitBranch className="h-4 w-4" />
                    Teruskan Disposisi
                  </Button>
                </Link>
              )}
              {hasPermission(ctx, 'memo.create') && (
                <Link href={`/nota-dinas/baru?root=${data.flow.root_flow_id}&from=/disposisi`}>
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
