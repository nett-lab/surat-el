import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button } from '@/components/ui/primitives';
import { FollowupsClient } from '@/components/master/MasterCrudClients';

export const metadata = { title: 'Pilihan Tindak Lanjut' };

export default async function MasterFollowupsPage() {
  await requirePermission('master.followup');
  const supabase = await createClient();
  const { data } = await supabase.from('followups').select('id, name, is_active').order('name');

  return (
    <div>
      <PageHeader
        title="Pilihan Tindak Lanjut"
        actions={
          <Link href="/master">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Master Data</Button>
          </Link>
        }
      />
      <FollowupsClient items={data || []} />
    </div>
  );
}
