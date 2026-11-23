import { requirePermission } from '@/lib/auth/session';
import { listInboxFlows } from '@/lib/data/letters';
import { PageHeader } from '@/components/ui/primitives';
import { InboxListClient } from '@/components/inbox/InboxListClient';

export const metadata = { title: 'Kotak Masuk Undangan' };

export default async function InboxUndanganPage({ searchParams }) {
  const ctx = await requirePermission('undangan.index');
  const params = await searchParams;
  const { items, total, page } = await listInboxFlows({
    positionId: ctx.position?.id,
    kind: 'distribution',
    category: 'invitation',
    search: params?.search || '',
    filter: params?.filter || 'all',
    page: params?.page || 1,
  });

  return (
    <div>
      <PageHeader
        title="Kotak Masuk — Undangan"
        description={ctx.position ? `Jabatan aktif: ${ctx.position.name}` : 'Anda belum memiliki jabatan aktif.'}
      />
      <InboxListClient
        items={items}
        total={total}
        page={page}
        basePath="/inbox/undangan"
        detailPrefix="/inbox/undangan"
        emptyTitle="Belum ada surat undangan"
      />
    </div>
  );
}
