# e-Surat v3 — Next.js (JavaScript) + Supabase di Vercel

Implementasi ulang **e-Surat** secara multi-tenant (satu project Supabase untuk banyak instansi dengan isolasi Row Level Security), dibangun dengan **Next.js 15 App Router (JavaScript murni)**, **Tailwind CSS 4**, **Supabase (Auth, PostgreSQL, Storage, Realtime, pg_cron)**, **Resend**, dan **Telegram Bot**.

## Fitur Utama

- **Multi-Tenant Sejati**: semua data diisolasi per `tenant_id` lewat PostgreSQL RLS. Mendukung pembuatan instansi manual oleh Platform Admin dan pendaftaran mandiri (`/daftar-instansi`) dengan persetujuan admin.
- **Siklus Hidup Surat Lengkap**:
  - Registrasi surat masuk (`/surat/baru`) dengan nomor agenda atomik (`agenda_counters`) dan lampiran PDF privat (verifikasi header `%PDF-`).
  - Daftar & kelola surat terkirim (`/surat/terkirim`), ubah metadata/penerima/lampiran, hapus lunak.
  - Kotak masuk **Utama** & **Undangan** dengan pencarian, filter baca/belum baca, dan sinkronisasi status baca dua arah.
  - **Disposisi** (dibatasi hierarki jabatan bawahan langsung + hak disposisi khusus yang diverifikasi di server) dan **Nota Dinas**.
  - **Penutupan Surat** (hanya oleh pemilik nota dinas non-CC) dan **Arsip** baca-saja lengkap dengan jejak audit (`letter_activities`).
- **Antrean Notifikasi (Vercel Hobby + Supabase)**:
  - Notifikasi in-app seketika melalui **Supabase Realtime**.
  - Outbox transaksional (`notification_jobs`) untuk **Resend (Email)** dan **Telegram Bot**: langsung dijalankan lewat `after()` setelah transaksi commit, ditambah sweeper `pg_cron` tiap menit (percobaan ulang hingga 3× dengan backoff 10 dtk / 60 dtk / 5 mnt).
  - Surat berklasifikasi **SR / R / T** otomatis diblok dari email dan Telegram.
- **Keamanan**: RLS penuh, validasi Zod client+server, 2FA TOTP (Supabase MFA), wajib ganti sandi sementara saat login pertama, rate limiting, security headers, dan dokumen privat dengan signed URL berumur 60 detik.

## Menjalankan Secara Lokal

```bash
npm install
cp .env.example .env.local
# Isi kredensial Supabase, Resend, dan CRON_SECRET di .env.local
npm run dev
```

## Setup Supabase

1. Jalankan seluruh migrasi di `supabase/migrations/` secara berurutan (`0001_schema.sql` sampai `0005_grants.sql`) melalui Supabase CLI (`supabase db push`) atau SQL Editor.
2. Untuk mengaktifkan sweeper `pg_cron` (paket Vercel Hobby), simpan dua secret berikut di **Supabase Vault** (SQL Editor):
   ```sql
   select vault.create_secret('https://domain-anda.vercel.app', 'esurat_app_url');
   select vault.create_secret('ISI_CRON_SECRET_YANG_SAMA_DENGAN_VERCEL', 'esurat_cron_secret');
   ```
3. Buat akun **Platform Admin** pertama:
   ```bash
   node --env-file=.env.local scripts/bootstrap-platform-admin.mjs admin@domain.com KataSandiKuat123
   ```
4. Masuk lewat `/login`, buka `/platform/tenants` untuk membuat instansi pertama (atau setujui pengajuan dari `/daftar-instansi`).

## Setup Telegram Bot (Opsional)

1. Isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, dan `TELEGRAM_WEBHOOK_SECRET` di environment Vercel.
2. Daftarkan webhook sekali:
   ```bash
   node --env-file=.env.local scripts/set-telegram-webhook.mjs
   ```
3. Super Admin instansi mengaktifkan kanal Telegram di menu **Antrean Notifikasi**, lalu setiap pegawai menautkan akunnya di **Pengaturan Profil**.

## Migrasi Data dari e-Surat v2 (Laravel)

1. Ekspor tabel v2 (`positions`, `ref_kode_klasifikasi_arsip`, `ref_agenda_surat`, `followups`, `roles`, `users`, `model_has_position`, `model_has_roles`, `model_has_special_dispositions`, `letters`, `letter_recipients`, `dispositions`, `memos`, `letter_docs`, `letter_activities`) ke satu file JSON `export-v2.json`.
2. Uji terlebih dahulu dengan `--dry-run`:
   ```bash
   node --env-file=.env.local scripts/migrate-v2.mjs --input ./export-v2.json --slug instansi-anda --name "Nama Instansi" --dry-run
   ```
3. Jalankan migrasi penuh (sertakan `--storage-dir` untuk menyalin lampiran PDF privat):
   ```bash
   node --env-file=.env.local scripts/migrate-v2.mjs --input ./export-v2.json --slug instansi-anda --name "Nama Instansi" --storage-dir ./storage/app/private
   ```
4. Skrip akan membuat berkas `migrated-credentials-<slug>.json` berisi kata sandi sementara setiap pengguna (wajib diganti saat login pertama).

## Perintah Verifikasi

```bash
npm run lint     # ESLint
npm test         # Unit test Vitest
npm run build    # Production build Next.js
```
