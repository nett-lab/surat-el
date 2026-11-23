import { requireAuth } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';

export default async function AuthenticatedLayout({ children }) {
  const ctx = await requireAuth({ allowPasswordChange: true });
  const supabase = await createClient();

  let counts = { primary: 0, invitation: 0, disposition: 0, memo: 0, unread_notifications: 0 };
  if (ctx.tenant) {
    const { data } = await supabase.rpc('inbox_counts');
    if (data) counts = data;
  }

  return (
    <AppShell ctx={ctx} initialCounts={counts}>
      {children}
    </AppShell>
  );
}
