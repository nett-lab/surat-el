import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button } from '@/components/ui/primitives';
import { RolesClient } from '@/components/master/MasterCrudClients';

export const metadata = { title: 'Role & Hak Akses' };

export default async function MasterRolesPage() {
  await requirePermission('master.pengguna');
  const supabase = await createClient();

  const [{ data: roles }, { data: perms }] = await Promise.all([
    supabase.from('roles').select('id, name, is_super, role_permissions (permission_key)').order('name'),
    supabase.from('permissions').select('key, label').order('key'),
  ]);

  const normalized = (roles || []).map((r) => ({
    id: r.id,
    name: r.name,
    is_super: r.is_super,
    permissions: (r.role_permissions || []).map((rp) => rp.permission_key),
  }));

  return (
    <div>
      <PageHeader
        title="Role & Hak Akses"
        actions={
          <Link href="/master">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Master Data</Button>
          </Link>
        }
      />
      <RolesClient roles={normalized} allPermissions={perms || []} />
    </div>
  );
}
