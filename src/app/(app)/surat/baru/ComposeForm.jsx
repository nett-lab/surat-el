'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { createLetterAction } from '@/actions/letters';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { PdfUploader } from '@/components/letter/PdfUploader';

export function ComposeForm({ classifications, positions }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    sender: '',
    number: '',
    letter_date: today,
    receipt_date: today,
    subject: '',
    category: 'primary',
    security_class: 'B',
    received_via: 'physical',
    classification_code: classifications[0]?.code || '',
    agenda_year: currentYear,
    instruction: '',
  });
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [docs, setDocs] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleRecipient(id) {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedRecipients.length === 0) {
      toast.error('Pilih minimal satu jabatan penerima.');
      return;
    }
    if (docs.length === 0) {
      toast.error('Unggah minimal satu dokumen PDF.');
      return;
    }

    setSubmitting(true);
    const res = await createLetterAction({
      ...form,
      agenda_year: Number(form.agenda_year),
      recipient_position_ids: selectedRecipients,
      docs: docs.map((d) => ({ name: d.name, path: d.path })),
    });
    setSubmitting(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    toast.success(`Surat terdaftar dengan nomor agenda ${res.agenda}.`);
    router.push(`/surat/terkirim/${res.letterId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-[var(--fg)]">1. Informasi Surat</h2>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sender" required>Pengirim / Asal Surat</Label>
            <Input
              id="sender"
              required
              value={form.sender}
              onChange={(e) => setForm({ ...form, sender: e.target.value })}
              placeholder="mis. Sekretariat Daerah Provinsi"
            />
          </div>
          <div>
            <Label htmlFor="number">Nomor Surat Asli</Label>
            <Input
              id="number"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              placeholder="mis. 005/1234/2026"
            />
          </div>
          <div>
            <Label htmlFor="letter_date" required>Tanggal Surat</Label>
            <Input
              id="letter_date"
              type="date"
              required
              value={form.letter_date}
              onChange={(e) => setForm({ ...form, letter_date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="receipt_date" required>Tanggal Diterima</Label>
            <Input
              id="receipt_date"
              type="date"
              required
              value={form.receipt_date}
              onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="subject" required>Perihal</Label>
            <Input
              id="subject"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Ringkasan isi atau perihal surat"
            />
          </div>
          <div>
            <Label htmlFor="category" required>Kategori Kotak Masuk</Label>
            <Select
              id="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="primary">Surat Masuk Utama</option>
              <option value="invitation">Surat Undangan</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="security_class" required>Klasifikasi Keamanan (TNDE)</Label>
            <Select
              id="security_class"
              value={form.security_class}
              onChange={(e) => setForm({ ...form, security_class: e.target.value })}
            >
              <option value="B">B — Biasa</option>
              <option value="T">T — Terbatas (tanpa email/Telegram)</option>
              <option value="R">R — Rahasia (tanpa email/Telegram)</option>
              <option value="SR">SR — Sangat Rahasia (tanpa email/Telegram)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="received_via" required>Sumber Penerimaan</Label>
            <Select
              id="received_via"
              value={form.received_via}
              onChange={(e) => setForm({ ...form, received_via: e.target.value })}
            >
              <option value="physical">Fisik / Pos</option>
              <option value="email">Email</option>
              <option value="internal">Internal</option>
              <option value="other">Lainnya</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label htmlFor="classification_code" required>Kode Klasifikasi</Label>
              <Select
                id="classification_code"
                required
                value={form.classification_code}
                onChange={(e) => setForm({ ...form, classification_code: e.target.value })}
              >
                {classifications.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="agenda_year" required>Tahun</Label>
              <Input
                id="agenda_year"
                type="number"
                min={1990}
                max={2100}
                required
                value={form.agenda_year}
                onChange={(e) => setForm({ ...form, agenda_year: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-[var(--fg)]">2. Tujuan Jabatan & Catatan</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label required>Pilih Jabatan Penerima ({selectedRecipients.length} dipilih)</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {positions.map((pos) => {
                const checked = selectedRecipients.includes(pos.id);
                return (
                  <label
                    key={pos.id}
                    className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-[var(--primary)] bg-blue-50/70 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200'
                        : 'border-[var(--border)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRecipient(pos.id)}
                      className="h-4 w-4 rounded accent-[var(--primary)]"
                    />
                    <span className="truncate">{pos.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="instruction">Catatan / Pengantar (opsional)</Label>
            <Textarea
              id="instruction"
              value={form.instruction}
              onChange={(e) => setForm({ ...form, instruction: e.target.value })}
              placeholder="Catatan awal untuk jabatan penerima..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-[var(--fg)]">3. Lampiran Dokumen PDF</h2>
        </CardHeader>
        <CardContent>
          <PdfUploader files={docs} onChange={setDocs} required />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Simpan & Distribusikan Surat
        </Button>
      </div>
    </form>
  );
}
