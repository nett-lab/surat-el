import Link from 'next/link';
import {
  FileText,
  ShieldCheck,
  GitBranch,
  Archive,
  Bell,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/primitives';

export default function HomePage() {
  const features = [
    {
      icon: FileText,
      title: 'Penomoran Agenda Atomik',
      desc: 'Nomor agenda otomatis per kode klasifikasi dan tahun tanpa duplikasi meski diakses bersamaan.',
    },
    {
      icon: GitBranch,
      title: 'Disposisi & Nota Dinas Terkendali',
      desc: 'Wewenang disposisi mengikuti hierarki jabatan dan hak khusus yang diverifikasi langsung di server.',
    },
    {
      icon: ShieldCheck,
      title: 'Isolasi Multi-Instansi & Kerahasiaan',
      desc: 'Row Level Security menjaga data antar instansi. Surat SR/R/T otomatis diblok dari email dan Telegram.',
    },
    {
      icon: Bell,
      title: 'Notifikasi Real-time, Email & Telegram',
      desc: 'Notifikasi in-app seketika ditambah antrean pengiriman ulang otomatis untuk Resend dan Telegram Bot.',
    },
    {
      icon: Archive,
      title: 'Arsip Baca-Saja & Jejak Audit',
      desc: 'Setiap pendaftaran, pembacaan, perubahan, dan penutupan surat terekam dalam riwayat audit.',
    },
    {
      icon: Building2,
      title: 'Lampiran PDF Privat',
      desc: 'Dokumen tersimpan di bucket privat dan hanya dapat dibuka oleh pihak berwenang lewat tautan sementara.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-[var(--fg)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
              <FileText className="h-5 w-5" />
            </span>
            <span className="text-lg tracking-tight">e-Surat</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/daftar-instansi">
              <Button variant="ghost" size="sm">Daftarkan Instansi</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Masuk</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--fg-muted)]">
              Multi-Tenant · Next.js + Supabase · Siap Produksi
            </p>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[var(--fg)] sm:text-5xl">
              Kelola siklus hidup surat resmi dalam satu sistem yang rapi dan aman.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">
              Dari registrasi surat masuk utama dan undangan, distribusi ke jabatan, disposisi berjenjang,
              nota dinas, hingga penutupan dan arsip baca-saja — lengkap dengan notifikasi Telegram dan email.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login">
                <Button size="lg">
                  Masuk ke Aplikasi
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/daftar-instansi">
                <Button variant="outline" size="lg">
                  Ajukan Pendaftaran Instansi
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-[var(--fg)]">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--fg-muted)]">
        e-Surat v3 — Sistem Manajemen Surat Elektronik Multi-Instansi
      </footer>
    </div>
  );
}
