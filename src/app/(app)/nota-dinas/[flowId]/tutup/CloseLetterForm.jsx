'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { closeLetterAction } from '@/actions/letters';
import { Button, Card, CardContent, Label, Select, Textarea } from '@/components/ui/primitives';

export function CloseLetterForm({ memoFlowId, defaultToPositionId, positions, letter }) {
  const router = useRouter();
  const [toPositionId, setToPositionId] = useState(defaultToPositionId || positions[0]?.id || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = await closeLetterAction({
      memo_flow_id: memoFlowId,
      to_position_id: toPositionId,
      note,
    });
    setSubmitting(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    toast.success('Surat berhasil ditutup dan dipindahkan ke Arsip.');
    router.push('/arsip');
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-[var(--surface-muted)] p-3.5 text-sm">
          <p className="text-xs text-[var(--fg-muted)]">Surat yang akan ditutup</p>
          <p className="font-bold text-[var(--fg)]">
            {letter.agenda} — {letter.subject}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="to_position_id" required>Jabatan Penerima Nota Penutupan</Label>
            <Select
              id="to_position_id"
              required
              value={toPositionId}
              onChange={(e) => setToPositionId(e.target.value)}
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="note">Catatan Penutupan (opsional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ringkasan penyelesaian tindak lanjut surat..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Konfirmasi Tutup Surat
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
