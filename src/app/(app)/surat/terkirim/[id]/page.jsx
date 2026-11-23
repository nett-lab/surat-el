import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission, hasPermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getLetterFullDetail } from '@/lib/data/letters';
import { PageHeader, Button } from '@/components/ui/primitives';
import { LetterDetailView } from '@/components/letter/LetterDetailView';
import { SentManageClient } from './SentManageClient';

export const metadata = { title: 'Detail Surat Terkirim' };

export default async function SentShowPage({ params }) {
  const ctx = await requirePermission('sent.show');
  const { id } = await params;
  const detail = await getLetterFullDetail(id);
  if (!detail) notFound();

  const supabase = await createClient();
  const { data: positions } = await supabase
    .from('positions')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  const distributionFlows = detail.flows.filter((f) => f.kind === 'distribution');
  const hasFollowups = detail.flows.some((f) => f.kind === 'disposition' || f.kind === 'memo');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detail Surat Terkirim"
        actions={
          <Link href="/surat/terkirim">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>
        }
      />
      <SentManageClient
        letter={detail.letter}
        distributionFlows={distributionFlows}
        docs={detail.docs}
        positions={positions || []}
        hasFollowups={hasFollowups}
        canEdit={hasPermission(ctx, 'sent.update')}
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
