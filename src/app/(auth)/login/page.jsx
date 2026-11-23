'use client';

import { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Loader2 } from 'lucide-react';
import { loginAction } from '@/actions/auth';
import { Button, Card, CardContent, Input, Label } from '@/components/ui/primitives';

function LoginForm() {
  const params = useSearchParams();
  const defaultTenant = params.get('instansi') || '';
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="tenantSlug">Kode Instansi (opsional jika masuk pakai email)</Label>
        <Input
          id="tenantSlug"
          name="tenantSlug"
          defaultValue={defaultTenant}
          placeholder="mis. pemda-kota"
          autoComplete="organization"
        />
      </div>

      <div>
        <Label htmlFor="identifier" required>Username atau Email</Label>
        <Input
          id="identifier"
          name="identifier"
          required
          placeholder="superadmin atau nama@instansi.go.id"
          autoComplete="username"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="password" required className="mb-0">Kata Sandi</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-[var(--primary)] hover:underline">
            Lupa kata sandi?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Masuk
      </Button>
    </form>
  );
}

export default function LoginPage() {
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
          <h1 className="text-lg font-bold text-[var(--fg)]">Masuk ke Akun Anda</h1>
          <p className="mt-1 mb-5 text-sm text-[var(--fg-muted)]">
            Gunakan username atau email yang terdaftar di instansi Anda.
          </p>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />}>
            <LoginForm />
          </Suspense>
          <p className="mt-5 text-center text-xs text-[var(--fg-muted)]">
            Instansi belum terdaftar?{' '}
            <Link href="/daftar-instansi" className="font-medium text-[var(--primary)] hover:underline">
              Ajukan pendaftaran
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
