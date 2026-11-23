import { requirePermission } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/ui/primitives';
import { QueueMonitorClient } from './QueueMonitorClient';

export const metadata = { title: 'Antrean Notifikasi' };

export default async function QueueMonitorPage() {
  const ctx = await requirePermission('master.pengguna');
  const admin = createAdminClient();

  const { data: jobs } = await admin
    .from('notification_jobs')
    .select('id, channel, status, attempts, last_error, created_at, sent_at')
    .eq('tenant_id', ctx.tenant.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Antrean Notifikasi (Telegram & Email)"
        description="Pantau pengiriman notifikasi eksternal dan kirim ulang job yang gagal. Surat SR/R/T tidak pernah masuk antrean ini."
      />
      <QueueMonitorClient
        jobs={jobs || []}
        features={ctx.tenant.features}
        isSuper={ctx.isSuper}
      />
    </div>
  );
}
