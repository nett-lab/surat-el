'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { createFlowAction } from '@/actions/letters';
import { Button, Card, CardContent, CardHeader, Label, Textarea } from '@/components/ui/primitives';
import { PdfUploader } from '@/components/letter/PdfUploader';

export function FlowFormClient({
  kind,
  rootFlowId,
  letter,
  positions,
  followupOptions = [],
  redirectTo,
}) {
  const router = useRouter();
  const [toPositions, setToPositions] = useState([]);
  const [ccPositions, setCcPositions] = useState([]);
  const [selectedFollowups, setSelectedFollowups] = useState([]);
  const [instruction, setInstruction] = useState('');
  const [docs, setDocs] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (list, setter, value) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (toPositions.length === 0) {
      toast.error('Pilih minimal satu jabatan tujuan utama.');
      return;
    }

    setSubmitting(true);
    const res = await createFlowAction({
      kind,
      root_flow_id: rootFlowId,
      to_positions: toPositions,
      cc_positions: ccPositions.filter((id) => !toPositions.includes(id)),
      instruction,
      followups: selectedFollowups,
      docs: docs.map((d) => ({ name: d.name, path: d.path })),
    });
    setSubmitting(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    toast.success(kind === 'disposition' ? 'Disposisi berhasil dikirim.' : 'Nota dinas berhasil dikirim.');
    router.push(redirectTo);
    router.refresh();
  }

  const label = kind === 'disposition' ? 'Disposisi' : 'Nota Dinas';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium text-[var(--fg-muted)]">Menindaklanjuti Surat</p>
          <p className="mt-0.5 text-sm font-bold text-[var(--fg)]">
            {letter.agenda} — {letter.subject}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-[var(--fg)]">Tujuan {label}</h2>
        </CardHeader>
        <CardContent className="space-y-5">
          {positions.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Tidak ada jabatan tujuan yang tersedia dalam wewenang Anda.
            </p>
          ) : (
            <>
              <div>
                <Label required>Tujuan Utama ({toPositions.length} dipilih)</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {positions.map((pos) => {
                    const checked = toPositions.includes(pos.id);
                    return (
                      <label
                        key={pos.id}
                        className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          checked
                            ? 'border-[var(--primary)] bg-blue-50/70 dark:bg-blue-950/50'
                            : 'border-[var(--border)] hover:bg-[var(--surface-muted)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(toPositions, setToPositions, pos.id)}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        <span className="truncate">{pos.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Tembusan / CC (opsional)</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {positions
                    .filter((p) => !toPositions.includes(p.id))
                    .map((pos) => {
                      const checked = ccPositions.includes(pos.id);
                      return (
                        <label
                          key={pos.id}
                          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(ccPositions, setCcPositions, pos.id)}
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          <span className="truncate">{pos.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </>
          )}

          {kind === 'disposition' && followupOptions.length > 0 && (
            <div>
              <Label>Arahan Tindak Lanjut (opsional)</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {followupOptions.map((f) => {
                  const checked = selectedFollowups.includes(f.name);
                  return (
                    <label
                      key={f.id}
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(selectedFollowups, setSelectedFollowups, f.name)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span>{f.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="instruction">Catatan / Instruksi</Label>
            <Textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={`Tulis catatan ${label.toLowerCase()}...`}
            />
          </div>

          <div>
            <Label>Lampiran Tambahan PDF (opsional)</Label>
            <PdfUploader files={docs} onChange={setDocs} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" disabled={submitting || positions.length === 0}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Kirim {label}
        </Button>
      </div>
    </form>
  );
}
