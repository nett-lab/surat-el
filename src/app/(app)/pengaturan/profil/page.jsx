import { requireAuth } from '@/lib/auth/session';
import { PageHeader } from '@/components/ui/primitives';
import { ProfileSettingsClient } from './ProfileSettingsClient';

export const metadata = { title: 'Pengaturan Profil' };

export default async function ProfileSettingsPage() {
  const ctx = await requireAuth();

  return (
    <div>
      <PageHeader
        title="Pengaturan Profil"
        description="Kelola informasi akun dan koneksi notifikasi Telegram Anda."
      />
      <ProfileSettingsClient
        profile={ctx.profile}
        telegramEnabled={Boolean(ctx.tenant?.features?.telegram)}
      />
    </div>
  );
}
