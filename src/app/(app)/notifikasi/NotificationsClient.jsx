'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  markAllNotificationsReadAction,
  deleteNotificationAction,
  deleteAllNotificationsAction,
} from '@/actions/notifications';
import { Button, Card, SecurityBadge, EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils/format';

export function NotificationsClient({ items }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleReadAll() {
    setBusy(true);
    await markAllNotificationsReadAction();
    setBusy(false);
    toast.success('Semua notifikasi ditandai sudah dibaca.');
    router.refresh();
  }

  async function handleDelete(id) {
    setBusy(true);
    await deleteNotificationAction(id);
    setBusy(false);
    router.refresh();
  }

  async function handleDeleteAll() {
    if (!window.confirm('Hapus seluruh riwayat notifikasi Anda?')) return;
    setBusy(true);
    await deleteAllNotificationsAction();
    setBusy(false);
    toast.success('Riwayat notifikasi dibersihkan.');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={handleReadAll}>
            <CheckCheck className="h-4 w-4" /> Tandai Semua Dibaca
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={handleDeleteAll}>
            <Trash2 className="h-4 w-4 text-red-600" /> Hapus Semua
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Belum ada notifikasi"
          description="Notifikasi surat masuk, disposisi, dan nota dinas akan muncul di sini secara langsung."
        />
      ) : (
        <Card className="divide-y divide-[var(--border)] overflow-hidden">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-3 p-4 ${
                !n.read_at ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
              }`}
            >
              <Link href={`/notifikasi/${n.id}/buka`} className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--fg)]">{n.title}</span>
                  <SecurityBadge code={n.security_class} />
                  {!n.read_at && (
                    <span className="h-2 w-2 rounded-full bg-[var(--primary)]" aria-label="Belum dibaca" />
                  )}
                </div>
                <p className="text-sm text-[var(--fg-muted)]">{n.body}</p>
                <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(n.created_at)}</p>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Hapus notifikasi"
                disabled={busy}
                onClick={() => handleDelete(n.id)}
              >
                <Trash2 className="h-4 w-4 text-[var(--fg-muted)]" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
