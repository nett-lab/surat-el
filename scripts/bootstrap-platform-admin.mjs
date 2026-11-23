#!/usr/bin/env node
/**
 * Membuat (atau menautkan) akun Platform Admin pertama untuk mengelola tenant di /platform/tenants.
 * Idempoten: jika email sudah terdaftar di auth.users, akun tersebut langsung ditambahkan ke platform_admins.
 *
 * Jalankan setelah migrasi 0001–0005 selesai:
 *   node --env-file=.env scripts/bootstrap-platform-admin.mjs admin@domain.com KataSandiKuat123
 */

import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Penggunaan: node --env-file=.env scripts/bootstrap-platform-admin.mjs <email> <password-min-8-karakter>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Env NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let userId = null;

const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
const existing = (listed?.users || []).find(
  (u) => u.email?.toLowerCase() === email.toLowerCase()
);

if (existing) {
  userId = existing.id;
  await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  console.log(`Akun auth sudah ada (${email}), kata sandi diperbarui.`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user) {
    console.error('Gagal membuat user:', error?.message);
    process.exit(1);
  }
  userId = data.user.id;
}

const { error: pErr } = await admin
  .from('platform_admins')
  .upsert({ user_id: userId }, { onConflict: 'user_id' });

if (pErr) {
  console.error('Gagal mendaftarkan platform_admin:', pErr.message);
  console.error('Pastikan migrasi 0001_schema.sql sampai 0005_grants.sql sudah dijalankan di Supabase.');
  process.exit(1);
}

console.log(`Platform Admin siap: ${email} (${userId}). Silakan masuk di /login lalu buka /platform/tenants.`);
