'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Send, Unlink, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfileAction } from '@/actions/auth';
import { createTelegramLinkAction, unlinkTelegramAction } from '@/actions/notifications';
import { Button, Card, CardContent, CardHeader, Input, Label, Badge } from '@/components/ui/primitives';

export function ProfileSettingsClient({ profile, telegramEnabled }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const [tgLink, setTgLink] = useState(null);
  const [tgBusy, setTgBusy] = useState(false);

  async function handleGenerateLink() {
    setTgBusy(true);
    const res = await createTelegramLinkAction();
    setTgBusy(false);
    if (res?.error) return toast.error(res.error);
    setTgLink(res);
  }

  async function handleUnlink() {
    if (!window.confirm('Putuskan tautan Telegram dari akun Anda?')) return;
    setTgBusy(true);
    await unlinkTelegramAction();
    setTgBusy(false);
    setTgLink(null);
    toast.success('Tautan Telegram diputuskan.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Link href="/pengaturan/profil">
          <Button size="sm" variant="primary">Profil & Telegram</Button>
        </Link>
        <Link href="/pengaturan/keamanan">
          <Button size="sm" variant="outline">
            <ShieldCheck className="h-4 w-4" /> Keamanan & 2FA
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader><h2 className="text-base font-semibold">Informasi Profil</h2></CardHeader>
        <CardContent>
          {state?.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              {state.success}
            </div>
          )}
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name" required>Nama Lengkap</Label>
              <Input id="name" name="name" required defaultValue={profile.name} />
            </div>
            <div>
              <Label>Username</Label>
              <Input disabled value={profile.username} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email (untuk notifikasi & pemulihan sandi)</Label>
              <Input id="email" name="email" type="email" defaultValue={profile.email || ''} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Profil
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Notifikasi Telegram</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Terima pemberitahuan surat masuk, disposisi, dan nota dinas (klasifikasi Biasa) lewat Bot Telegram.
            </p>
          </div>
          <Badge variant={profile.telegram_chat_id ? 'success' : 'neutral'}>
            {profile.telegram_chat_id ? 'Terhubung' : 'Belum Terhubung'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {!telegramEnabled ? (
            <p className="text-sm text-[var(--fg-muted)]">
              Fitur Telegram belum diaktifkan untuk instansi Anda. Hubungi Super Admin instansi.
            </p>
          ) : profile.telegram_chat_id ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--fg)]">Akun Telegram Anda sudah terhubung.</p>
              <Button size="sm" variant="danger" disabled={tgBusy} onClick={handleUnlink}>
                <Unlink className="h-4 w-4" /> Putuskan Tautan
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button size="sm" disabled={tgBusy} onClick={handleGenerateLink}>
                {tgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Buat Tautan & Kode QR Telegram
              </Button>

              {tgLink && (
                <div className="flex flex-col items-start gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4 sm:flex-row sm:items-center">
                  <div
                    className="rounded-lg bg-white p-2"
                    dangerouslySetInnerHTML={{ __html: tgLink.svg }}
                  />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-[var(--fg)]">
                      Pindai QR atau klik tombol di bawah lalu tekan <strong>Start</strong> di Telegram (berlaku 10 menit):
                    </p>
                    <a
                      href={tgLink.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--primary)] px-3.5 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
                    >
                      Buka Bot Telegram
                    </a>
                    <div>
                      <Button size="sm" variant="outline" onClick={() => router.refresh()}>
                        Saya sudah menekan Start — Periksa Status
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
