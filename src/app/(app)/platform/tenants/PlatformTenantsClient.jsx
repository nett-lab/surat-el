'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check, X, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  createTenantManualAction,
  approveTenantRequestAction,
  rejectTenantRequestAction,
  toggleTenantStatusAction,
} from '@/actions/platform';
import { Button, Card, CardContent, CardHeader, Input, Label, Badge } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils/format';

export function PlatformTenantsClient({ tenants, requests }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [provisioned, setProvisioned] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    org_name: '',
    slug: '',
    admin_name: '',
    admin_email: '',
    enableEmail: false,
    enableTelegram: false,
  });

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    const res = await createTenantManualAction(form);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    setProvisioned(res);
    setShowCreate(false);
    setForm({ org_name: '', slug: '', admin_name: '', admin_email: '', enableEmail: false, enableTelegram: false });
    toast.success('Instansi baru berhasil dibuat.');
    router.refresh();
  }

  async function handleApprove(id) {
    setBusy(true);
    const res = await approveTenantRequestAction(id);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    setProvisioned(res);
    toast.success('Pengajuan disetujui dan instansi telah aktif.');
    router.refresh();
  }

  async function handleReject(id) {
    const note = window.prompt('Alasan penolakan (opsional):') ?? '';
    setBusy(true);
    await rejectTenantRequestAction(id, note);
    setBusy(false);
    toast.success('Pengajuan ditolak.');
    router.refresh();
  }

  async function handleToggle(tenant) {
    setBusy(true);
    await toggleTenantStatusAction(tenant.id, tenant.status === 'active' ? 'suspended' : 'active');
    setBusy(false);
    toast.success('Status instansi diperbarui.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" /> Buat Instansi Manual
        </Button>
      </div>

      {provisioned && (
        <Card className="border-emerald-300 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-sm">
              <KeyRound className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-semibold">Instansi {provisioned.tenant.name} ({provisioned.tenant.slug}) siap!</p>
                <p>
                  Username: <strong>{provisioned.username}</strong> · Kata sandi sementara:{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-900">
                    {provisioned.tempPassword}
                  </code>
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setProvisioned(null)}>Tutup</Button>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Buat Instansi Baru (Manual)</h2></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Nama Instansi</Label>
                <Input required value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} />
              </div>
              <div>
                <Label required>Kode Instansi (slug)</Label>
                <Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
              </div>
              <div>
                <Label required>Nama Admin Pertama</Label>
                <Input required value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} />
              </div>
              <div>
                <Label required>Email Admin Pertama</Label>
                <Input type="email" required value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.enableEmail} onChange={(e) => setForm({ ...form, enableEmail: e.target.checked })} />
                  Aktifkan notifikasi Email (Resend)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.enableTelegram} onChange={(e) => setForm({ ...form, enableTelegram: e.target.checked })} />
                  Aktifkan notifikasi Telegram
                </label>
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Buat Instansi</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Pengajuan Pendaftaran Mandiri ({requests.length})</h2>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--border)] p-0">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--fg)]">{r.org_name}</span>
                    <Badge>{r.slug}</Badge>
                  </div>
                  <p className="text-xs text-[var(--fg-muted)]">
                    PIC: {r.admin_name} ({r.admin_email}) · {formatDateTime(r.created_at)}
                  </p>
                  {r.note && <p className="text-xs text-[var(--fg-muted)]">Catatan: {r.note}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" disabled={busy} onClick={() => handleApprove(r.id)}>
                    <Check className="h-4 w-4" /> Setujui
                  </Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => handleReject(r.id)}>
                    <X className="h-4 w-4" /> Tolak
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader><h2 className="text-base font-semibold">Daftar Instansi Terdaftar ({tenants.length})</h2></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--fg-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Instansi</th>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Kanal Aktif</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Badge variant={t.features?.email ? 'primary' : 'neutral'}>Email</Badge>
                      <Badge variant={t.features?.telegram ? 'primary' : 'neutral'}>Telegram</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === 'active' ? 'success' : 'danger'}>
                      {t.status === 'active' ? 'Aktif' : 'Ditangguhkan'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => handleToggle(t)}>
                      {t.status === 'active' ? 'Tangguhkan' : 'Aktifkan'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
