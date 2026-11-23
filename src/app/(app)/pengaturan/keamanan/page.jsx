import { requireAuth } from '@/lib/auth/session';
import { PageHeader } from '@/components/ui/primitives';
import { SecuritySettingsClient } from './SecuritySettingsClient';

export const metadata = { title: 'Keamanan Akun' };

export default async function SecuritySettingsPage() {
  const ctx = await requireAuth({ allowPasswordChange: true });

  return (
    <div>
      <PageHeader
        title="Keamanan Akun"
        description="Ubah kata sandi dan kelola Autentikasi Dua Langkah (2FA)."
      />
      <SecuritySettingsClient mustChangePassword={Boolean(ctx.profile?.must_change_password)} />
    </div>
  );
}
