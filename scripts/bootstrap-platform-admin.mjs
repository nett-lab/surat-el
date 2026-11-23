#!/usr/bin/env node
/**
 * Membuat akun Platform Admin pertama untuk mengelola tenant di /platform/tenants.
 * Jalankan sekali setelah migrasi SQL selesai:
 *   node scripts/bootstrap-platform-admin.mjs admin@domain.com KataSandiKuat123
 */

import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Penggunaan: node scripts/bootstrap-platform-admin.mjs <email> <password-min-8-karakter>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Env NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error || !data?.user) {
  console.error('Gagal membuat user:', error?.message);
  process.exit(1);
}

const { error: pErr } = await admin.from('platform_admins').insert({ user_id: data.user.id });
if (pErr) {
  console.error('Gagal mendaftarkan platform_admin:', pErr.message);
  process.exit(1);
}

console.log(`Platform Admin siap: ${email} (${data.user.id}). Silakan masuk di /login lalu buka /platform/tenants.`);
