import { requirePermission } from '@/lib/auth/session';
import { listInboxFlows } from '@/lib/data/letters';
import { PageHeader } from '@/components/ui/primitives';
import { InboxListClient } from '@/components/inbox/InboxListClient';

export const metadata = { title: 'Kotak Masuk Utama' };

export default async function InboxPrimaryPage({ searchParams }) {
  const ctx = await requirePermission('primary.index');
  const params = await searchParams;
  const { items, total, page } = await listInboxFlows({
    positionId: ctx.position?.id,
    kind: 'distribution',
    category: 'primary',
    search: params?.search || '',
    filter: params?.filter || 'all',
    page: params?.page || 1,
  });

  return (
    <div>
      <PageHeader
        title="Kotak Masuk — Surat Utama"
        description={ctx.position ? `Jabatan aktif: ${ctx.position.name}` : 'Anda belum memiliki jabatan aktif.'}
      />
      <InboxListClient
        items={items}
        total={total}
        page={page}
        basePath="/inbox/utama"
        detailPrefix="/inbox/utama"
        emptyTitle="Belum ada surat masuk utama"
      />
    </div>
  );
}
