'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardContent, Input, Label } from '@/components/ui/primitives';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError('Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.');
      return;
    }
    toast.success('Kata sandi berhasil diperbarui.');
    router.push('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 py-12">
      <Link href="/" className="mb-6 flex items-center gap-2.5 font-bold text-[var(--fg)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
          <FileText className="h-5 w-5" />
        </span>
        <span className="text-xl">e-Surat</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="text-lg font-bold text-[var(--fg)]">Atur Kata Sandi Baru</h1>
          <p className="mt-1 mb-5 text-sm text-[var(--fg-muted)]">
            Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.
          </p>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" required>Kata Sandi Baru</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm" required>Ulangi Kata Sandi</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Kata Sandi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
