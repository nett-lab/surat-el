'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileText, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { createSignedUploadUrlAction } from '@/actions/letters';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function PdfUploader({ files, onChange, required = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(fileList) {
    const selected = Array.from(fileList || []);
    if (selected.length === 0) return;

    setUploading(true);
    const supabase = createClient();
    const added = [];

    for (const file of selected) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`"${file.name}" ditolak: hanya file PDF yang diperbolehkan.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" melebihi batas maksimal 10 MB.`);
        continue;
      }

      const signed = await createSignedUploadUrlAction(file.name);
      if (signed.error) {
        toast.error(signed.error);
        continue;
      }

      const { error } = await supabase.storage
        .from('letter-docs')
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: 'application/pdf',
        });

      if (error) {
        toast.error(`Gagal mengunggah "${file.name}".`);
        continue;
      }

      added.push({ name: file.name, path: signed.path, size: file.size });
    }

    setUploading(false);
    if (added.length > 0) {
      onChange([...files, ...added]);
      toast.success(`${added.length} dokumen PDF berhasil diunggah.`);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeAt(idx) {
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-7 text-center transition-colors hover:border-[var(--primary)]"
      >
        {uploading ? (
          <Loader2 className="mb-2 h-7 w-7 animate-spin text-[var(--primary)]" />
        ) : (
          <UploadCloud className="mb-2 h-7 w-7 text-[var(--fg-muted)]" />
        )}
        <p className="text-sm font-medium text-[var(--fg)]">
          {uploading ? 'Mengunggah dokumen...' : 'Klik atau seret file PDF ke sini'}
        </p>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          Format PDF saja, maksimal 10 MB per berkas{required ? ' (wajib minimal 1 berkas)' : ''}.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, idx) => (
            <li
              key={f.path}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-red-600" />
                <span className="truncate font-medium text-[var(--fg)]">{f.name}</span>
              </span>
              <button
                type="button"
                aria-label={`Hapus ${f.name}`}
                onClick={() => removeAt(idx)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-600 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
