import { requireAuth } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/primitives';
import { NotificationsClient } from './NotificationsClient';

export const metadata = { title: 'Pusat Notifikasi' };

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, url, item_type, security_class, read_at, created_at')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Pusat Notifikasi"
        description="Status baca tersinkronisasi dua arah dengan surat, disposisi, dan nota dinas terkait."
      />
      <NotificationsClient items={data || []} />
    </div>
  );
}
