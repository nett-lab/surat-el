import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button } from '@/components/ui/primitives';
import { ClassificationsClient } from '@/components/master/MasterCrudClients';

export const metadata = { title: 'Klasifikasi Arsip' };

export default async function MasterClassificationsPage() {
  await requirePermission('master.klasifikasi');
  const supabase = await createClient();
  const { data } = await supabase.from('classifications').select('id, code, name, is_active').order('code');

  return (
    <div>
      <PageHeader
        title="Kode Klasifikasi Arsip"
        actions={
          <Link href="/master">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Master Data</Button>
          </Link>
        }
      />
      <ClassificationsClient items={data || []} />
    </div>
  );
}
