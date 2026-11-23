'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, ArrowLeft } from 'lucide-react';
import { requestPasswordResetAction } from '@/actions/auth';
import { Button, Card, CardContent, Input, Label } from '@/components/ui/primitives';

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);

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
          <h1 className="text-lg font-bold text-[var(--fg)]">Lupa Kata Sandi</h1>
          <p className="mt-1 mb-5 text-sm text-[var(--fg-muted)]">
            Masukkan alamat email Anda untuk menerima tautan pengaturan ulang kata sandi.
          </p>

          {state?.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              {state.success}
            </div>
          )}

          <form action={action} className="space-y-4">
            <div>
              <Label htmlFor="email" required>Alamat Email</Label>
              <Input id="email" name="email" type="email" required placeholder="nama@instansi.go.id" />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Kirim Tautan Reset
            </Button>
          </form>

          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke halaman masuk
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
