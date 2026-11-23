import { requirePermission } from '@/lib/auth/session';
import { listInboxFlows } from '@/lib/data/letters';
import { PageHeader } from '@/components/ui/primitives';
import { InboxListClient } from '@/components/inbox/InboxListClient';

export const metadata = { title: 'Nota Dinas' };

export default async function MemoIndexPage({ searchParams }) {
  const ctx = await requirePermission('memo.index');
  const params = await searchParams;
  const { items, total, page } = await listInboxFlows({
    positionId: ctx.position?.id,
    kind: 'memo',
    search: params?.search || '',
    filter: params?.filter || 'all',
    page: params?.page || 1,
  });

  return (
    <div>
      <PageHeader
        title="Nota Dinas Masuk"
        description={ctx.position ? `Jabatan aktif: ${ctx.position.name}` : 'Anda belum memiliki jabatan aktif.'}
      />
      <InboxListClient
        items={items}
        total={total}
        page={page}
        basePath="/nota-dinas"
        detailPrefix="/nota-dinas"
        emptyTitle="Belum ada nota dinas masuk"
        showFromPosition
      />
    </div>
  );
}
