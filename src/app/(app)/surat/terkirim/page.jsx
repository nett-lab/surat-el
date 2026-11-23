import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { requirePermission, hasPermission } from '@/lib/auth/session';
import { listLetters } from '@/lib/data/letters';
import { PageHeader, Button } from '@/components/ui/primitives';
import { InboxListClient } from '@/components/inbox/InboxListClient';

export const metadata = { title: 'Surat Terkirim' };

export default async function SentIndexPage({ searchParams }) {
  const ctx = await requirePermission('sent.index');
  const params = await searchParams;
  const { items, total, page } = await listLetters({
    search: params?.search || '',
    page: params?.page || 1,
  });

  // Format agar kompatibel dengan InboxListClient (status selalu terbaca di daftar terkirim).
  const normalized = items.map((l) => ({
    id: l.id,
    read_at: l.created_at,
    received_at: l.created_at,
    letter: l,
  }));

  return (
    <div>
      <PageHeader
        title="Surat Terkirim"
        description="Daftar surat masuk yang telah didaftarkan dan didistribusikan."
        actions={
          hasPermission(ctx, 'compose.create') && (
            <Link href="/surat/baru">
              <Button>
                <FilePlus2 className="h-4 w-4" />
                Catat Surat Baru
              </Button>
            </Link>
          )
        }
      />
      <InboxListClient
        items={normalized}
        total={total}
        page={page}
        basePath="/surat/terkirim"
        detailPrefix="/surat/terkirim"
        emptyTitle="Belum ada surat terdaftar"
        showFilter={false}
      />
    </div>
  );
}
