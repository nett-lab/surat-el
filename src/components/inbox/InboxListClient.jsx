'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search, Inbox, ChevronLeft, ChevronRight, MailOpen, Mail } from 'lucide-react';
import { Button, Card, Input, Badge, SecurityBadge, EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils/format';

export function InboxListClient({
  items,
  total,
  page,
  perPage = 15,
  basePath,
  detailPrefix,
  emptyTitle,
  showFromPosition = false,
  showFilter = true,
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const activeFilter = params.get('filter') || 'all';
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function updateQuery(patch) {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === 'all') next.delete(k);
      else next.set(k, String(v));
    });
    if (!('page' in patch)) next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateQuery({ search: search.trim() });
          }}
          className="flex flex-1 gap-2 sm:max-w-md"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--fg-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari agenda, pengirim, perihal, nomor..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Cari</Button>
        </form>

        {showFilter && (
          <div className="flex gap-1.5">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'unread', label: 'Belum Dibaca' },
              { id: 'read', label: 'Sudah Dibaca' },
            ].map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={activeFilter === f.id ? 'primary' : 'outline'}
                onClick={() => updateQuery({ filter: f.id })}
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={emptyTitle || 'Belum ada surat'}
          description="Data surat yang sesuai filter akan tampil di sini."
        />
      ) : (
        <>
          {/* Tabel Desktop */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--fg-muted)] uppercase">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Agenda & Sifat</th>
                    <th className="px-4 py-3">Perihal & Pengirim</th>
                    {showFromPosition && <th className="px-4 py-3">Dari Jabatan</th>}
                    <th className="px-4 py-3">Diterima</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((item) => {
                    const unread = !item.read_at;
                    const letter = item.letter || item;
                    return (
                      <tr
                        key={item.id}
                        className={unread ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'hover:bg-[var(--surface-muted)]/40'}
                      >
                        <td className="px-4 py-3">
                          {unread ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                              <Mail className="h-3.5 w-3.5" /> Baru
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                              <MailOpen className="h-3.5 w-3.5" /> Dibaca
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-[var(--fg)]">{letter.agenda}</div>
                          <div className="mt-1 flex items-center gap-1">
                            <SecurityBadge code={letter.security_class} />
                            {item.is_cc && <Badge>CC</Badge>}
                            {item.is_closing && <Badge variant="success">Penutupan</Badge>}
                          </div>
                        </td>
                        <td className="max-w-md px-4 py-3">
                          <Link
                            href={`${detailPrefix}/${item.id}`}
                            className="line-clamp-1 font-medium text-[var(--fg)] hover:text-[var(--primary)] hover:underline"
                          >
                            {letter.subject}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">
                            {letter.sender}
                            {letter.number ? ` · ${letter.number}` : ''}
                          </p>
                        </td>
                        {showFromPosition && (
                          <td className="px-4 py-3 text-xs text-[var(--fg)]">
                            {item.from_position?.name || '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs whitespace-nowrap text-[var(--fg-muted)]">
                          {formatDateTime(item.received_at || letter.receipt_date)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`${detailPrefix}/${item.id}`}>
                            <Button size="sm" variant="outline">Buka</Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Kartu Mobile */}
          <div className="space-y-3 md:hidden">
            {items.map((item) => {
              const unread = !item.read_at;
              const letter = item.letter || item;
              return (
                <Link key={item.id} href={`${detailPrefix}/${item.id}`} className="block">
                  <Card className={unread ? 'border-l-4 border-l-[var(--primary)]' : ''}>
                    <div className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--primary)]">{letter.agenda}</span>
                        <div className="flex items-center gap-1">
                          <SecurityBadge code={letter.security_class} />
                          {item.is_cc && <Badge>CC</Badge>}
                        </div>
                      </div>
                      <p className="line-clamp-2 text-sm font-semibold text-[var(--fg)]">{letter.subject}</p>
                      <p className="text-xs text-[var(--fg-muted)]">
                        {showFromPosition && item.from_position?.name
                          ? `Dari ${item.from_position.name} · `
                          : ''}
                        {letter.sender}
                      </p>
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        {formatDateTime(item.received_at || letter.receipt_date)}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-[var(--fg-muted)]">
              <span>
                Halaman {page} dari {totalPages} ({total} data)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => updateQuery({ page: page - 1 })}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => updateQuery({ page: page + 1 })}
                >
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
