'use client';

import { useActionState, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updatePasswordAction } from '@/actions/auth';
import { Button, Card, CardContent, CardHeader, Input, Label, Badge } from '@/components/ui/primitives';

export function SecuritySettingsClient({ mustChangePassword }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [code, setCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  async function loadFactors() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
  }

  useEffect(() => {
    loadFactors();
  }, []);

  async function startEnroll() {
    setMfaBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'e-Surat Authenticator',
    });
    setMfaBusy(false);
    if (error) return toast.error('Gagal memulai pendaftaran 2FA.');
    setEnrolling(data);
  }

  async function verifyEnroll(e) {
    e.preventDefault();
    setMfaBusy(true);
    const supabase = createClient();
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (chErr) {
      setMfaBusy(false);
      return toast.error('Gagal membuat tantangan 2FA.');
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.id,
      challengeId: ch.id,
      code: code.trim(),
    });
    setMfaBusy(false);
    if (verErr) return toast.error('Kode tidak valid. Coba lagi.');
    toast.success('Autentikasi Dua Langkah (2FA) berhasil diaktifkan.');
    setEnrolling(null);
    setCode('');
    await loadFactors();
    router.refresh();
  }

  async function removeFactor(id) {
    if (!window.confirm('Nonaktifkan 2FA dari akun ini?')) return;
    setMfaBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setMfaBusy(false);
    if (error) return toast.error('Gagal menonaktifkan 2FA.');
    toast.success('2FA dinonaktifkan.');
    await loadFactors();
  }

  const verifiedFactors = factors.filter((f) => f.status === 'verified');

  return (
    <div className="space-y-6">
      {!mustChangePassword && (
        <div className="flex gap-2">
          <Link href="/pengaturan/profil">
            <Button size="sm" variant="outline">Profil & Telegram</Button>
          </Link>
          <Link href="/pengaturan/keamanan">
            <Button size="sm" variant="primary">
              <ShieldCheck className="h-4 w-4" /> Keamanan & 2FA
            </Button>
          </Link>
        </div>
      )}

      {mustChangePassword && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Untuk keamanan akun Anda, silakan ganti kata sandi sementara sebelum melanjutkan ke aplikasi.
        </div>
      )}

      <Card>
        <CardHeader><h2 className="text-base font-semibold">Ubah Kata Sandi</h2></CardHeader>
        <CardContent>
          {state?.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              {state.success}{' '}
              {mustChangePassword && (
                <Link href="/dashboard" className="font-semibold underline">
                  Lanjut ke Dashboard
                </Link>
              )}
            </div>
          )}
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="password" required>Kata Sandi Baru</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
              <p className="mt-1 text-xs text-[var(--fg-muted)]">Minimal 8 karakter, kombinasi huruf & angka.</p>
            </div>
            <div>
              <Label htmlFor="confirmPassword" required>Ulangi Kata Sandi Baru</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Perbarui Kata Sandi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Autentikasi Dua Langkah (2FA TOTP)</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Lindungi akun dengan kode sekali pakai dari Google Authenticator, Authy, atau 1Password.
            </p>
          </div>
          <Badge variant={verifiedFactors.length > 0 ? 'success' : 'neutral'}>
            {verifiedFactors.length > 0 ? 'Aktif' : 'Nonaktif'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {verifiedFactors.length > 0 ? (
            <div className="space-y-2">
              {verifiedFactors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm"
                >
                  <span>{f.friendly_name || 'Aplikasi Autentikator'}</span>
                  <Button size="sm" variant="danger" disabled={mfaBusy} onClick={() => removeFactor(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Nonaktifkan
                  </Button>
                </div>
              ))}
            </div>
          ) : enrolling ? (
            <form onSubmit={verifyEnroll} className="space-y-4">
              <p className="text-sm text-[var(--fg-muted)]">
                Pindai QR berikut menggunakan aplikasi autentikator Anda, lalu masukkan 6 digit kodenya:
              </p>
              {/* Supabase Auth mengembalikan data URI SVG QR code */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrolling.totp.qr_code}
                alt="QR Code 2FA TOTP"
                className="h-48 w-48 rounded-lg border border-[var(--border)] bg-white p-2"
              />
              <div className="max-w-xs">
                <Label htmlFor="totp-code" required>Kode 6 Digit</Label>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEnrolling(null)}>Batal</Button>
                <Button type="submit" disabled={mfaBusy || code.length !== 6}>
                  {mfaBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verifikasi & Aktifkan
                </Button>
              </div>
            </form>
          ) : (
            <Button size="sm" disabled={mfaBusy} onClick={startEnroll}>
              {mfaBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Aktifkan 2FA TOTP
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
