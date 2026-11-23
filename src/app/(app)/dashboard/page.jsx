import Link from 'next/link';
import { FilePlus2, Building2 } from 'lucide-react';
import { requireAuth, hasPermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button, Card, CardContent } from '@/components/ui/primitives';
import { DashboardView } from '@/components/charts/DashboardView';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage({ searchParams }) {
  const ctx = await requireAuth();
  const params = await searchParams;
  const supabase = await createClient();

  if (!ctx.tenant && ctx.isPlatformAdmin) {
    return (
      <div>
        <PageHeader
          title="Panel Platform Admin"
          description="Anda masuk sebagai pengelola platform multi-instansi."
          actions={
            <Link href="/platform/tenants">
              <Button>
                <Building2 className="h-4 w-4" />
                Kelola Instansi
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--fg-muted)]">
              Gunakan menu Kelola Instansi untuk membuat tenant baru atau menyetujui pengajuan pendaftaran mandiri.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: summary } = await supabase.rpc('dashboard_summary', { p_days: 30 });

  return (
    <div>
      {params?.denied === '1' && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Anda tidak memiliki izin untuk membuka halaman tersebut.
        </div>
      )}
      <PageHeader
        title={`Selamat datang, ${ctx.profile.name}`}
        description={`${ctx.tenant.name}${ctx.position ? ` · ${ctx.position.name}` : ''}`}
        actions={
          hasPermission(ctx, 'compose.create') && (
            <Link href="/surat/baru">
              <Button>
                <FilePlus2 className="h-4 w-4" />
                Catat Surat Masuk
              </Button>
            </Link>
          )
        }
      />
      <DashboardView initial={summary || { mode: 'user', stats: {}, series: [] }} />
    </div>
  );
}
