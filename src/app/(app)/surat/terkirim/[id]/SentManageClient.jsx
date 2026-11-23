'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Users, Paperclip, Trash2, Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  updateLetterMetaAction,
  updateLetterRecipientsAction,
  updateLetterDocsAction,
  deleteLetterAction,
} from '@/actions/letters';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Select,
} from '@/components/ui/primitives';
import { PdfUploader } from '@/components/letter/PdfUploader';

export function SentManageClient({ letter, distributionFlows, docs, positions, hasFollowups, canEdit }) {
  const router = useRouter();
  const [panel, setPanel] = useState(null); // 'meta' | 'recipients' | 'docs'
  const [busy, setBusy] = useState(false);

  const [meta, setMeta] = useState({
    sender: letter.sender,
    number: letter.number || '',
    letter_date: letter.letter_date,
    receipt_date: letter.receipt_date,
    category: letter.category,
    security_class: letter.security_class,
    received_via: letter.received_via,
    subject: letter.subject,
  });

  const [recipients, setRecipients] = useState(
    distributionFlows.map((f) => ({
      id: f.id,
      to_position_id: f.to_position_id,
      instruction: f.instruction || '',
    }))
  );

  const [removeDocIds, setRemoveDocIds] = useState([]);
  const [newDocs, setNewDocs] = useState([]);

  if (!canEdit || letter.status !== 'open') return null;

  async function saveMeta(e) {
    e.preventDefault();
    setBusy(true);
    const res = await updateLetterMetaAction(letter.id, meta);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Metadata surat berhasil diperbarui.');
    setPanel(null);
    router.refresh();
  }

  async function saveRecipients(e) {
    e.preventDefault();
    setBusy(true);
    const res = await updateLetterRecipientsAction(letter.id, recipients);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Daftar penerima berhasil diperbarui.');
    setPanel(null);
    router.refresh();
  }

  async function saveDocs(e) {
    e.preventDefault();
    if (removeDocIds.length === 0 && newDocs.length === 0) {
      setPanel(null);
      return;
    }
    setBusy(true);
    const res = await updateLetterDocsAction(
      letter.id,
      removeDocIds,
      newDocs.map((d) => ({ name: d.name, path: d.path }))
    );
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Lampiran surat berhasil diperbarui.');
    setRemoveDocIds([]);
    setNewDocs([]);
    setPanel(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm('Yakin menghapus surat ini? Data surat dan alurnya akan diarsipkan sebagai terhapus.')) {
      return;
    }
    setBusy(true);
    const res = await deleteLetterAction(letter.id);
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    toast.success('Surat berhasil dihapus.');
    router.push('/surat/terkirim');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={panel === 'meta' ? 'primary' : 'outline'} onClick={() => setPanel(panel === 'meta' ? null : 'meta')}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Info Surat
        </Button>
        {!hasFollowups && (
          <Button size="sm" variant={panel === 'recipients' ? 'primary' : 'outline'} onClick={() => setPanel(panel === 'recipients' ? null : 'recipients')}>
            <Users className="h-3.5 w-3.5" />
            Edit Penerima
          </Button>
        )}
        <Button size="sm" variant={panel === 'docs' ? 'primary' : 'outline'} onClick={() => setPanel(panel === 'docs' ? null : 'docs')}>
          <Paperclip className="h-3.5 w-3.5" />
          Edit Lampiran
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Hapus Surat
        </Button>
      </div>

      {panel === 'meta' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Perbarui Informasi Surat</h3>
            <button type="button" onClick={() => setPanel(null)} aria-label="Tutup">
              <X className="h-4 w-4 text-[var(--fg-muted)]" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveMeta} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Pengirim</Label>
                <Input required value={meta.sender} onChange={(e) => setMeta({ ...meta, sender: e.target.value })} />
              </div>
              <div>
                <Label>Nomor Surat</Label>
                <Input value={meta.number} onChange={(e) => setMeta({ ...meta, number: e.target.value })} />
              </div>
              <div>
                <Label required>Tanggal Surat</Label>
                <Input type="date" required value={meta.letter_date} onChange={(e) => setMeta({ ...meta, letter_date: e.target.value })} />
              </div>
              <div>
                <Label required>Tanggal Diterima</Label>
                <Input type="date" required value={meta.receipt_date} onChange={(e) => setMeta({ ...meta, receipt_date: e.target.value })} />
              </div>
              <div>
                <Label required>Kategori</Label>
                <Select value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>
                  <option value="primary">Surat Utama</option>
                  <option value="invitation">Undangan</option>
                </Select>
              </div>
              <div>
                <Label required>Klasifikasi Keamanan</Label>
                <Select value={meta.security_class} onChange={(e) => setMeta({ ...meta, security_class: e.target.value })}>
                  <option value="B">B — Biasa</option>
                  <option value="T">T — Terbatas</option>
                  <option value="R">R — Rahasia</option>
                  <option value="SR">SR — Sangat Rahasia</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label required>Perihal</Label>
                <Input required value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setPanel(null)}>Batal</Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {panel === 'recipients' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Perbarui Jabatan Penerima</h3>
            <button type="button" onClick={() => setPanel(null)} aria-label="Tutup">
              <X className="h-4 w-4 text-[var(--fg-muted)]" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveRecipients} className="space-y-3">
              {recipients.map((r, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Select
                      value={r.to_position_id}
                      onChange={(e) => {
                        const copy = [...recipients];
                        copy[idx] = { ...copy[idx], to_position_id: e.target.value };
                        setRecipients(copy);
                      }}
                    >
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-6">
                    <Input
                      placeholder="Catatan (opsional)"
                      value={r.instruction}
                      onChange={(e) => {
                        const copy = [...recipients];
                        copy[idx] = { ...copy[idx], instruction: e.target.value };
                        setRecipients(copy);
                      }}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={recipients.length <= 1}
                      onClick={() => setRecipients(recipients.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setRecipients([...recipients, { id: null, to_position_id: positions[0]?.id || '', instruction: '' }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Penerima
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setPanel(null)}>Batal</Button>
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Simpan Penerima
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {panel === 'docs' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Kelola Lampiran PDF</h3>
            <button type="button" onClick={() => setPanel(null)} aria-label="Tutup">
              <X className="h-4 w-4 text-[var(--fg-muted)]" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveDocs} className="space-y-4">
              {docs.length > 0 && (
                <div className="space-y-2">
                  <Label>Lampiran Saat Ini (centang untuk menghapus)</Label>
                  {docs.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={removeDocIds.includes(d.id)}
                        onChange={(e) =>
                          setRemoveDocIds(
                            e.target.checked
                              ? [...removeDocIds, d.id]
                              : removeDocIds.filter((id) => id !== d.id)
                          )
                        }
                      />
                      <span className={removeDocIds.includes(d.id) ? 'line-through text-red-600' : ''}>
                        {d.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div>
                <Label>Tambah Lampiran Baru</Label>
                <PdfUploader files={newDocs} onChange={setNewDocs} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPanel(null)}>Batal</Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Lampiran
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
