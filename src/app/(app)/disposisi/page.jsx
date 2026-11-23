import { requirePermission } from '@/lib/auth/session';
import { listInboxFlows } from '@/lib/data/letters';
import { PageHeader } from '@/components/ui/primitives';
import { InboxListClient } from '@/components/inbox/InboxListClient';

export const metadata = { title: 'Disposisi' };

export default async function DispositionIndexPage({ searchParams }) {
  const ctx = await requirePermission('disposition.index');
  const params = await searchParams;
  const { items, total, page } = await listInboxFlows({
    positionId: ctx.position?.id,
    kind: 'disposition',
    search: params?.search || '',
    filter: params?.filter || 'all',
    page: params?.page || 1,
  });

  return (
    <div>
      <PageHeader
        title="Disposisi Masuk"
        description={ctx.position ? `Jabatan aktif: ${ctx.position.name}` : 'Anda belum memiliki jabatan aktif.'}
      />
      <InboxListClient
        items={items}
        total={total}
        page={page}
        basePath="/disposisi"
        detailPrefix="/disposisi"
        emptyTitle="Belum ada disposisi masuk"
        showFromPosition
      />
    </div>
  );
}
