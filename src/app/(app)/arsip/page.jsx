import { requirePermission } from '@/lib/auth/session';
import { listLetters } from '@/lib/data/letters';
import { PageHeader } from '@/components/ui/primitives';
import { InboxListClient } from '@/components/inbox/InboxListClient';

export const metadata = { title: 'Arsip Surat' };

export default async function ArsipIndexPage({ searchParams }) {
  await requirePermission('arsip.index');
  const params = await searchParams;
  const { items, total, page } = await listLetters({
    status: 'closed',
    search: params?.search || '',
    page: params?.page || 1,
  });

  const normalized = items.map((l) => ({
    id: l.id,
    read_at: l.receipt_date,
    received_at: l.receipt_date,
    letter: l,
  }));

  return (
    <div>
      <PageHeader
        title="Arsip Surat"
        description="Surat masuk yang telah ditutup (baca-saja) lengkap dengan metadata TNDE dan riwayat audit."
      />
      <InboxListClient
        items={normalized}
        total={total}
        page={page}
        basePath="/arsip"
        detailPrefix="/arsip"
        emptyTitle="Belum ada surat di arsip"
        showFilter={false}
      />
    </div>
  );
}
