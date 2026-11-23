'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Building2, Loader2, ArrowLeft } from 'lucide-react';
import { submitTenantRequestAction } from '@/actions/auth';
import { Button, Card, CardContent, Input, Label, Textarea } from '@/components/ui/primitives';

export default function DaftarInstansiPage() {
  const [state, action, pending] = useActionState(submitTenantRequestAction, null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-[var(--fg)]">Ajukan Pendaftaran Instansi</h1>
          <p className="mt-1 mb-5 text-sm text-[var(--fg-muted)]">
            Pendaftaran mandiri akan ditinjau oleh administrator platform sebelum ruang kerja instansi diaktifkan.
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

          {!state?.success && (
            <form action={action} className="space-y-4">
              <div>
                <Label htmlFor="org_name" required>Nama Instansi / Organisasi</Label>
                <Input id="org_name" name="org_name" required placeholder="Dinas Komunikasi dan Informatika" />
              </div>

              <div>
                <Label htmlFor="slug" required>Kode Instansi (unik)</Label>
                <Input
                  id="slug"
                  name="slug"
                  required
                  placeholder="diskominfo-kota"
                  pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                />
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                  Huruf kecil, angka, dan tanda hubung (3–40 karakter). Dipakai saat masuk dengan username.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="admin_name" required>Nama Penanggung Jawab</Label>
                  <Input id="admin_name" name="admin_name" required placeholder="Budi Santoso" />
                </div>
                <div>
                  <Label htmlFor="admin_email" required>Email Resmi</Label>
                  <Input id="admin_email" name="admin_email" type="email" required placeholder="admin@instansi.go.id" />
                </div>
              </div>

              <div>
                <Label htmlFor="note">Catatan Tambahan (opsional)</Label>
                <Textarea id="note" name="note" placeholder="Perkiraan jumlah pengguna atau kebutuhan khusus" />
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Kirim Pengajuan
              </Button>
            </form>
          )}

          <div className="mt-5 flex items-center justify-between text-xs text-[var(--fg-muted)]">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-[var(--fg)]">
              <ArrowLeft className="h-3.5 w-3.5" />
              Beranda
            </Link>
            <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
              Sudah punya akun? Masuk
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
