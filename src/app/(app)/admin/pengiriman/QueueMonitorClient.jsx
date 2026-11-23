'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { retryNotificationJobAction } from '@/actions/notifications';
import { updateTenantFeaturesAction } from '@/actions/master';
import { Button, Card, CardContent, CardHeader, Badge } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils/format';

export function QueueMonitorClient({ jobs, features, isSuper }) {
  const router = useRouter();
  const [feat, setFeat] = useState({
    email: Boolean(features?.email),
    telegram: Boolean(features?.telegram),
  });
  const [busy, setBusy] = useState(false);

  async function saveFeatures() {
    setBusy(true);
    const res = await updateTenantFeaturesAction(feat);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Pengaturan kanal notifikasi instansi disimpan.');
    router.refresh();
  }

  async function retryJob(id) {
    setBusy(true);
    const res = await retryNotificationJobAction(id);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Job dijadwalkan ulang untuk dikirim.');
    router.refresh();
  }

  const statusVariant = {
    sent: 'success',
    pending: 'warning',
    processing: 'primary',
    failed: 'danger',
  };

  return (
    <div className="space-y-6">
      {isSuper && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Kanal Notifikasi Eksternal Instansi (Fail-Closed)</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={feat.email}
                  onChange={(e) => setFeat({ ...feat, email: e.target.checked })}
                />
                Email (Resend)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={feat.telegram}
                  onChange={(e) => setFeat({ ...feat, telegram: e.target.checked })}
                />
                Telegram Bot
              </label>
            </div>
            <Button size="sm" disabled={busy} onClick={saveFeatures}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Kanal
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-base font-semibold">Riwayat Antrean Pengiriman (50 terbaru)</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--fg-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Kanal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Percobaan</th>
                <th className="px-4 py-3">Waktu / Galat Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                    Belum ada antrean pengiriman eksternal.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-3 font-medium uppercase">{j.channel}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[j.status] || 'neutral'}>{j.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{j.attempts} / 3</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{formatDateTime(j.sent_at || j.created_at)}</div>
                      {j.last_error && (
                        <div className="mt-0.5 max-w-md truncate text-red-600 dark:text-red-400">
                          {j.last_error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {j.status === 'failed' && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => retryJob(j.id)}>
                          <RefreshCw className="h-3.5 w-3.5" /> Kirim Ulang
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
