import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button } from '@/components/ui/primitives';
import { PositionsClient } from '@/components/master/MasterCrudClients';

export const metadata = { title: 'Master Jabatan' };

export default async function MasterPositionsPage() {
  await requirePermission('master.jabatan');
  const supabase = await createClient();
  const { data } = await supabase.from('positions').select('id, name, parent_id, is_active').order('name');

  return (
    <div>
      <PageHeader
        title="Jabatan & Hierarki"
        description="Relasi induk-bawahan menentukan wewenang tujuan disposisi otomatis."
        actions={
          <Link href="/master">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Master Data</Button>
          </Link>
        }
      />
      <PositionsClient items={data || []} />
    </div>
  );
}
