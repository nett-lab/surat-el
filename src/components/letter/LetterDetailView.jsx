'use client';

import { useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  GitBranch,
  History,
  Info,
} from 'lucide-react';
import { Card, CardContent, Badge, SecurityBadge, Button } from '@/components/ui/primitives';
import {
  formatDate,
  formatDateTime,
  CATEGORY_LABELS,
  RECEIVED_VIA_LABELS,
  FLOW_KIND_LABELS,
} from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function LetterDetailView({ letter, flows = [], docs = [], activities = [], actions }) {
  const [tab, setTab] = useState('detail');
  const [previewDoc, setPreviewDoc] = useState(docs[0] || null);

  const tabs = [
    { id: 'detail', label: 'Detail Surat', icon: Info },
    { id: 'docs', label: `Lampiran (${docs.length})`, icon: FileText },
    { id: 'timeline', label: `Riwayat Alur (${flows.length})`, icon: GitBranch },
    { id: 'audit', label: `Audit (${activities.length})`, icon: History },
  ];

  return (
    <div className="space-y-5">
      {/* Header kartu ringkasan */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">Agenda: {letter.agenda}</Badge>
              <SecurityBadge code={letter.security_class} showLabel />
              <Badge variant={letter.status === 'closed' ? 'success' : 'warning'}>
                {letter.status === 'closed' ? 'Ditutup (Arsip)' : 'Terbuka'}
              </Badge>
              <Badge>{CATEGORY_LABELS[letter.category] || letter.category}</Badge>
            </div>
            <h2 className="text-lg font-bold text-[var(--fg)] sm:text-xl">{letter.subject}</h2>
            <p className="text-sm text-[var(--fg-muted)]">
              Dari <strong className="text-[var(--fg)]">{letter.sender}</strong>
              {letter.number ? ` · Nomor: ${letter.number}` : ''}
            </p>
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </CardContent>
      </Card>

      {/* Navigasi tab */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer',
                active
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Detail */}
      {tab === 'detail' && (
        <Card>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Nomor Agenda</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--fg)]">{letter.agenda}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Nomor Surat Asli</dt>
                <dd className="mt-1 text-sm text-[var(--fg)]">{letter.number || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Pengirim</dt>
                <dd className="mt-1 text-sm text-[var(--fg)]">{letter.sender}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Tanggal Surat</dt>
                <dd className="mt-1 text-sm text-[var(--fg)]">{formatDate(letter.letter_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Tanggal Diterima</dt>
                <dd className="mt-1 text-sm text-[var(--fg)]">{formatDate(letter.receipt_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Sumber Penerimaan</dt>
                <dd className="mt-1 text-sm text-[var(--fg)]">
                  {RECEIVED_VIA_LABELS[letter.received_via] || letter.received_via}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Didaftarkan Oleh</dt>
                <dd className="mt-1 text-sm text-[var(--fg)]">{letter.creator?.name || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--fg-muted)]">Waktu Pencatatan</dt>
                <dd className="mt-1 text-sm text-[var(--fg)]">{formatDateTime(letter.created_at)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Tab: Lampiran */}
      {tab === 'docs' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-5 w-5 shrink-0 text-red-600" />
                    <span className="truncate text-sm font-medium text-[var(--fg)]">{doc.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant={previewDoc?.id === doc.id ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewDoc(doc)}
                      className="hidden sm:inline-flex"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Pratinjau
                    </Button>
                    <a
                      href={`/api/docs/${doc.id}?mode=download`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--fg)] hover:bg-[var(--surface-muted)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {previewDoc && (
            <Card className="hidden overflow-hidden sm:block">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 text-xs text-[var(--fg-muted)]">
                <span>Pratinjau: {previewDoc.name}</span>
                <a
                  href={`/api/docs/${previewDoc.id}?mode=inline`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--primary)] hover:underline"
                >
                  Buka di tab baru
                </a>
              </div>
              <iframe
                title={previewDoc.name}
                src={`/api/docs/${previewDoc.id}?mode=inline`}
                className="h-[640px] w-full bg-slate-100 dark:bg-slate-900"
              />
            </Card>
          )}
        </div>
      )}

      {/* Tab: Riwayat Alur */}
      {tab === 'timeline' && (
        <Card>
          <CardContent className="space-y-4">
            {flows.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">Belum ada riwayat alur surat.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-[var(--border)] pl-5">
                {flows.map((f) => (
                  <li key={f.id} className="relative">
                    <span className="absolute -left-[25px] top-1 flex h-3 w-3 rounded-full border-2 border-[var(--primary)] bg-[var(--surface)]" />
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={f.is_closing ? 'success' : f.kind === 'disposition' ? 'warning' : 'primary'}>
                            {f.is_closing ? 'Penutupan Surat' : FLOW_KIND_LABELS[f.kind] || f.kind}
                          </Badge>
                          {f.is_cc && <Badge>Tembusan (CC)</Badge>}
                        </div>
                        <span className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDateTime(f.received_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--fg)]">
                        <strong>{f.from_position?.name || '-'}</strong> →{' '}
                        <strong>{f.to_position?.name || '-'}</strong>
                      </p>
                      {Array.isArray(f.followups) && f.followups.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {f.followups.map((fu) => (
                            <Badge key={fu} variant="neutral">{fu}</Badge>
                          ))}
                        </div>
                      )}
                      {f.instruction && (
                        <p className="mt-2 text-sm text-[var(--fg-muted)]">
                          Catatan: {f.instruction}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                        <CheckCircle2 className={cn('h-3.5 w-3.5', f.read_at ? 'text-emerald-600' : 'text-slate-400')} />
                        {f.read_at ? `Dibaca ${formatDateTime(f.read_at)}` : 'Belum dibaca'}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Audit */}
      {tab === 'audit' && (
        <Card>
          <CardContent className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">Belum ada catatan audit.</p>
            ) : (
              activities.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-[var(--fg)]">{a.description}</span>
                    <span className="text-xs text-[var(--fg-muted)]">{formatDateTime(a.created_at)}</span>
                  </div>
                  <p className="text-xs text-[var(--fg-muted)]">Oleh: {a.user?.name || '-'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
