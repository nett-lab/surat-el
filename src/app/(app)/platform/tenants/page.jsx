import { requirePlatformAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/ui/primitives';
import { PlatformTenantsClient } from './PlatformTenantsClient';

export const metadata = { title: 'Kelola Instansi (Platform)' };

export default async function PlatformTenantsPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [{ data: tenants }, { data: requests }] = await Promise.all([
    admin.from('tenants').select('id, slug, name, status, features, created_at').order('created_at', { ascending: false }),
    admin.from('tenant_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="Kelola Instansi (Multi-Tenant)"
        description="Buat instansi baru secara manual atau tinjau pendaftaran mandiri yang menunggu persetujuan."
      />
      <PlatformTenantsClient tenants={tenants || []} requests={requests || []} />
    </div>
  );
}
