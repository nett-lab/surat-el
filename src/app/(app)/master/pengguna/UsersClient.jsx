'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  createUserAction,
  updateUserAction,
  updateUserPositionAction,
  updateUserRolesAction,
  updateSpecialDispositionsAction,
} from '@/actions/master';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Select,
  Badge,
} from '@/components/ui/primitives';

export function UsersClient({ users, positions, roles }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    position_id: positions[0]?.id || '',
    role_id: roles.find((r) => !r.is_super)?.id || roles[0]?.id || '',
  });

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    const res = await createUserAction(newUser);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    setCreatedCreds({ username: res.username, tempPassword: res.tempPassword });
    setNewUser({
      name: '',
      username: '',
      email: '',
      position_id: positions[0]?.id || '',
      role_id: roles.find((r) => !r.is_super)?.id || roles[0]?.id || '',
    });
    setShowCreate(false);
    toast.success('Pengguna berhasil dibuat.');
    router.refresh();
  }

  function openEdit(u) {
    setEditing({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email || '',
      is_active: u.is_active,
      position_id: u.activePosition?.id || positions[0]?.id || '',
      role_ids: u.roleIds || [],
      special_ids: u.specialIds || [],
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setBusy(true);
    const r1 = await updateUserAction(editing.id, {
      name: editing.name,
      username: editing.username,
      email: editing.email,
      is_active: editing.is_active,
    });
    if (r1?.error) {
      setBusy(false);
      return toast.error(r1.error);
    }
    if (editing.position_id) {
      await updateUserPositionAction(editing.id, editing.position_id);
    }
    await updateUserRolesAction(editing.id, editing.role_ids);
    await updateSpecialDispositionsAction(editing.id, editing.special_ids);
    setBusy(false);
    setEditing(null);
    toast.success('Data pengguna berhasil diperbarui.');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" />
          Tambah Pengguna
        </Button>
      </div>

      {createdCreds && (
        <Card className="border-emerald-300 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-sm">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                  Kredensial Sementara (tampil satu kali)
                </p>
                <p className="text-emerald-800 dark:text-emerald-300">
                  Username: <strong>{createdCreds.username}</strong> · Kata sandi:{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-900">
                    {createdCreds.tempPassword}
                  </code>
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCreatedCreds(null)}>
              Tutup
            </Button>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Tambah Pengguna Baru</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Nama Lengkap</Label>
                <Input required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              </div>
              <div>
                <Label required>Username</Label>
                <Input
                  required
                  placeholder="huruf kecil, tanpa spasi"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase() })}
                />
              </div>
              <div>
                <Label>Email (opsional, untuk notifikasi & reset)</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div>
                <Label required>Jabatan</Label>
                <Select value={newUser.position_id} onChange={(e) => setNewUser({ ...newUser, position_id: e.target.value })}>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label required>Role</Label>
                <Select value={newUser.role_id} onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Buat Akun
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Kelola Pengguna: {editing.name}</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEdit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Nama Lengkap</Label>
                  <Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label required>Username</Label>
                  <Input required value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value.toLowerCase() })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                </div>
                <div>
                  <Label>Jabatan Aktif</Label>
                  <Select value={editing.position_id} onChange={(e) => setEditing({ ...editing, position_id: e.target.value })}>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Akun aktif (dapat masuk dan menerima notifikasi)
              </label>

              <div>
                <Label>Role Pengguna</Label>
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const checked = editing.role_ids.includes(r.id);
                    return (
                      <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditing({
                              ...editing,
                              role_ids: checked
                                ? editing.role_ids.filter((id) => id !== r.id)
                                : [...editing.role_ids, r.id],
                            })
                          }
                        />
                        {r.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Hak Disposisi Khusus (jabatan di luar hierarki bawahan langsung)</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {positions.map((p) => {
                    const checked = editing.special_ids.includes(p.id);
                    return (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditing({
                              ...editing,
                              special_ids: checked
                                ? editing.special_ids.filter((id) => id !== p.id)
                                : [...editing.special_ids, p.id],
                            })
                          }
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Batal</Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
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
                <th className="px-4 py-3">Nama & Username</th>
                <th className="px-4 py-3">Jabatan Aktif</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--fg)]">{u.name}</div>
                    <div className="text-xs text-[var(--fg-muted)]">
                      @{u.username}{u.email ? ` · ${u.email}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--fg)]">
                    {u.activePosition?.name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roleNames.map((rn) => (
                        <Badge key={rn} variant="primary">{rn}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.is_active ? 'success' : 'danger'}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                      Kelola
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
