import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { getLetterFullDetail } from '@/lib/data/letters';
import { PageHeader, Button } from '@/components/ui/primitives';
import { LetterDetailView } from '@/components/letter/LetterDetailView';

export const metadata = { title: 'Detail Arsip Surat' };

export default async function ArsipShowPage({ params }) {
  await requirePermission('arsip.show');
  const { id } = await params;

  const detail = await getLetterFullDetail(id, { requireClosed: true });
  if (!detail) notFound();

  return (
    <div>
      <PageHeader
        title="Detail Arsip Surat (Baca-Saja)"
        actions={
          <Link href="/arsip">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>
        }
      />
      <LetterDetailView
        letter={detail.letter}
        flows={detail.flows}
        docs={detail.docs}
        activities={detail.activities}
      />
    </div>
  );
}
