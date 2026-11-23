'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardContent, Input, Label } from '@/components/ui/primitives';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (!totp) {
        router.push('/dashboard');
        return;
      }

      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (chErr) throw chErr;

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verErr) throw verErr;

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Kode verifikasi tidak valid atau sudah kedaluwarsa.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-[var(--fg)]">Verifikasi Dua Langkah (2FA)</h1>
          <p className="mt-1 mb-5 text-sm text-[var(--fg-muted)]">
            Masukkan 6 digit kode dari aplikasi autentikator Anda.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <Label htmlFor="code" required>Kode Autentikator</Label>
              <Input
                id="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                className="text-center text-lg tracking-[0.35em]"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Verifikasi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
