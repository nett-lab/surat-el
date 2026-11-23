'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  FilePlus2,
  Send,
  Inbox,
  GitBranch,
  StickyNote,
  Archive,
  Database,
  Bell,
  Settings,
  Building2,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  FileText,
  MailWarning,
  Mail,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logoutAction } from '@/actions/auth';
import { cn } from '@/lib/utils/cn';

function can(ctx, perm) {
  if (!perm) return true;
  if (ctx.isSuper) return true;
  return perm.split('|').some((p) => {
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -1);
      return ctx.permissions.some((up) => up.startsWith(prefix));
    }
    return ctx.permissions.includes(p);
  });
}

export function AppShell({ ctx, initialCounts, children }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState(initialCounts);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Langganan Realtime pada tabel notifications milik user untuk pembaruan badge live.
  useEffect(() => {
    if (!ctx?.user?.id) return;
    const supabase = createClient();
    const refresh = async () => {
      const { data } = await supabase.rpc('inbox_counts');
      if (data) setCounts(data);
    };

    const channel = supabase
      .channel(`notif-${ctx.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${ctx.user.id}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ctx?.user?.id]);

  const navGroups = [
    {
      label: 'Utama',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/surat/baru', label: 'Buat Surat', icon: FilePlus2, perm: 'compose.create' },
        { href: '/surat/terkirim', label: 'Terkirim', icon: Send, perm: 'sent.index' },
      ],
    },
    {
      label: 'Kotak Masuk',
      items: [
        { href: '/inbox/utama', label: 'Surat Utama', icon: Inbox, perm: 'primary.index', badge: counts.primary },
        { href: '/inbox/undangan', label: 'Undangan', icon: Mail, perm: 'undangan.index', badge: counts.invitation },
        { href: '/disposisi', label: 'Disposisi', icon: GitBranch, perm: 'disposition.index', badge: counts.disposition },
        { href: '/nota-dinas', label: 'Nota Dinas', icon: StickyNote, perm: 'memo.index', badge: counts.memo },
        { href: '/arsip', label: 'Arsip', icon: Archive, perm: 'arsip.index' },
      ],
    },
    {
      label: 'Administrasi',
      items: [
        { href: '/master', label: 'Master Data', icon: Database, perm: 'master.*' },
        { href: '/admin/pengiriman', label: 'Antrean Notifikasi', icon: MailWarning, perm: 'master.pengguna' },
        { href: '/pengaturan/profil', label: 'Pengaturan', icon: Settings },
        ...(ctx.isPlatformAdmin
          ? [{ href: '/platform/tenants', label: 'Kelola Instansi', icon: Building2 }]
          : []),
      ],
    },
  ];

  const renderNav = (onSelect) => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navigasi utama">
      {navGroups.map((group) => {
        const visible = group.items.filter((i) => can(ctx, i.perm));
        if (visible.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-[var(--fg-muted)] uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {visible.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onSelect}
                      className={cn(
                        'flex min-h-10 items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]'
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {Number(item.badge) > 0 && (
                        <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[11px] font-semibold text-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-[var(--border)] p-3">
      <div className="mb-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
        <p className="truncate text-sm font-semibold text-[var(--fg)]">{ctx.profile?.name}</p>
        <p className="truncate text-xs text-[var(--fg-muted)]">
          {ctx.position?.name || (ctx.isPlatformAdmin ? 'Platform Admin' : 'Belum ada jabatan')}
        </p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-[var(--border)] px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--fg)]">e-Surat</p>
            <p className="truncate text-xs text-[var(--fg-muted)]">
              {ctx.tenant?.name || 'Platform Admin'}
            </p>
          </div>
        </div>
        {renderNav()}
        {sidebarFooter}
      </aside>

      {/* Drawer Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-[var(--surface)] shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-bold text-[var(--fg)]">
                  {ctx.tenant?.name || 'e-Surat'}
                </span>
              </div>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-muted)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNav(() => setMobileOpen(false))}
            {sidebarFooter}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Buka menu navigasi"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-muted)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-[var(--fg-muted)] lg:hidden">
              {ctx.tenant?.name || 'e-Surat'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {mounted && (
              <button
                type="button"
                aria-label="Ganti tema tampilan"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
            <Link
              href="/notifikasi"
              aria-label="Pusat notifikasi"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]"
            >
              <Bell className="h-4 w-4" />
              {Number(counts.unread_notifications) > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {counts.unread_notifications > 9 ? '9+' : counts.unread_notifications}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
