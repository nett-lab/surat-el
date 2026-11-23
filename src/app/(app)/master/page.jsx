import Link from 'next/link';
import { Users, Network, Shield, FolderTree, ListChecks } from 'lucide-react';
import { requirePermission, hasPermission } from '@/lib/auth/session';
import { PageHeader, Card, CardContent } from '@/components/ui/primitives';

export const metadata = { title: 'Master Data' };

export default async function MasterIndexPage() {
  const ctx = await requirePermission('master.*');

  const menus = [
    {
      href: '/master/pengguna',
      title: 'Pengguna',
      desc: 'Kelola akun, jabatan aktif, role, dan hak disposisi khusus.',
      icon: Users,
      perm: 'master.pengguna',
    },
    {
      href: '/master/jabatan',
      title: 'Jabatan & Hierarki',
      desc: 'Susun struktur organisasi dan relasi atasan-bawahan.',
      icon: Network,
      perm: 'master.jabatan',
    },
    {
      href: '/master/role',
      title: 'Role & Hak Akses',
      desc: 'Atur matriks izin untuk tiap peran di instansi Anda.',
      icon: Shield,
      perm: 'master.pengguna',
    },
    {
      href: '/master/klasifikasi',
      title: 'Klasifikasi Arsip',
      desc: 'Kode klasifikasi untuk penomoran agenda surat masuk otomatis.',
      icon: FolderTree,
      perm: 'master.klasifikasi',
    },
    {
      href: '/master/tindak-lanjut',
      title: 'Pilihan Tindak Lanjut',
      desc: 'Daftar arahan cepat saat membuat disposisi surat.',
      icon: ListChecks,
      perm: 'master.followup',
    },
  ].filter((m) => hasPermission(ctx, m.perm));

  return (
    <div>
      <PageHeader
        title="Master Data"
        description="Pengaturan struktur organisasi dan data referensi instansi."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {menus.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href} className="group block">
              <Card className="h-full transition-colors group-hover:border-[var(--primary)]">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[var(--fg)] group-hover:text-[var(--primary)]">
                      {m.title}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">{m.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
