'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { savePositionAction, saveClassificationAction, saveFollowupAction, saveRoleAction } from '@/actions/master';
import { Button, Card, CardContent, CardHeader, Input, Label, Select, Badge } from '@/components/ui/primitives';

export function PositionsClient({ items }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const byId = new Map(items.map((i) => [i.id, i.name]));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await savePositionAction(form.id, {
      name: form.name,
      parent_id: form.parent_id || null,
      is_active: form.is_active,
    });
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Data jabatan tersimpan.');
    setForm(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ id: null, name: '', parent_id: '', is_active: true })}>
          <Plus className="h-4 w-4" /> Tambah Jabatan
        </Button>
      </div>
      {form && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">{form.id ? 'Edit Jabatan' : 'Jabatan Baru'}</h2></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Nama Jabatan</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Jabatan Induk (Atasan Langsung)</Label>
                <Select value={form.parent_id || ''} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
                  <option value="">— Tidak ada (Puncak) —</option>
                  {items.filter((i) => i.id !== form.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Aktif
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Batal</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--fg-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Jabatan</th>
                <th className="px-4 py-3">Induk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">{p.parent_id ? byId.get(p.parent_id) || '-' : 'Puncak'}</td>
                  <td className="px-4 py-3"><Badge variant={p.is_active ? 'success' : 'danger'}>{p.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...p, parent_id: p.parent_id || '' })}>Edit</Button>
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

export function ClassificationsClient({ items }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await saveClassificationAction(form.id, {
      code: form.code,
      name: form.name,
      is_active: form.is_active,
    });
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Klasifikasi arsip tersimpan.');
    setForm(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ id: null, code: '', name: '', is_active: true })}>
          <Plus className="h-4 w-4" /> Tambah Klasifikasi
        </Button>
      </div>
      {form && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">{form.id ? 'Edit Klasifikasi' : 'Klasifikasi Baru'}</h2></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label required>Kode (mis. 005)</Label>
                <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label required>Nama Klasifikasi</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Aktif
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Batal</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--fg-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3"><Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setForm(c)}>Edit</Button>
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

export function FollowupsClient({ items }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await saveFollowupAction(form.id, { name: form.name, is_active: form.is_active });
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Pilihan tindak lanjut tersimpan.');
    setForm(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ id: null, name: '', is_active: true })}>
          <Plus className="h-4 w-4" /> Tambah Tindak Lanjut
        </Button>
      </div>
      {form && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label required>Nama Tindak Lanjut</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Aktif
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setForm(null)}>Batal</Button>
                  <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--fg-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Arahan Tindak Lanjut</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 font-medium">{f.name}</td>
                  <td className="px-4 py-3"><Badge variant={f.is_active ? 'success' : 'danger'}>{f.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setForm(f)}>Edit</Button>
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

export function RolesClient({ roles, allPermissions }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await saveRoleAction(form.id, { name: form.name, permissions: form.permissions });
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Role dan izin tersimpan.');
    setForm(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ id: null, name: '', permissions: [] })}>
          <Plus className="h-4 w-4" /> Tambah Role
        </Button>
      </div>
      {form && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">{form.id ? `Edit Role: ${form.name}` : 'Role Baru'}</h2></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label required>Nama Role</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Izin ({form.permissions.length} dipilih)</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {allPermissions.map((p) => {
                    const checked = form.permissions.includes(p.key);
                    return (
                      <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] p-2.5 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          className="mt-0.5"
                          onChange={() =>
                            setForm({
                              ...form,
                              permissions: checked
                                ? form.permissions.filter((k) => k !== p.key)
                                : [...form.permissions, p.key],
                            })
                          }
                        />
                        <span>
                          <span className="block font-mono font-semibold text-[var(--fg)]">{p.key}</span>
                          <span className="text-[var(--fg-muted)]">{p.label}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Batal</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan Role</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--fg)]">{r.name}</h3>
                {r.is_super ? (
                  <Badge variant="primary">Akses Penuh</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ id: r.id, name: r.name, permissions: r.permissions })}
                  >
                    Atur Izin
                  </Button>
                )}
              </div>
              <p className="text-xs text-[var(--fg-muted)]">
                {r.is_super ? 'Memiliki seluruh hak akses dalam instansi.' : `${r.permissions.length} izin aktif`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
