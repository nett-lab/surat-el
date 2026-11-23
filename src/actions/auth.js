'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loginSchema, tenantRequestSchema, passwordChangeSchema, profileUpdateSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';

async function getClientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown').split(',')[0].trim();
}

export async function loginAction(_prevState, formData) {
  const raw = {
    tenantSlug: String(formData.get('tenantSlug') || ''),
    identifier: String(formData.get('identifier') || ''),
    password: String(formData.get('password') || ''),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Isian login tidak valid.' };
  }

  const { tenantSlug, identifier, password } = parsed.data;
  const admin = createAdminClient();
  const ip = await getClientIp();

  const { data: allowed } = await admin.rpc('check_rate_limit', {
    p_key: `login:${ip}`,
    p_max: 15,
    p_window_seconds: 60,
  });
  if (allowed === false) {
    return { error: 'Terlalu banyak percobaan masuk. Tunggu 1 menit lalu coba lagi.' };
  }

  let authEmail = identifier;

  // Jika bukan format email, cari berdasarkan username (opsional dibatasi tenantSlug).
  if (!identifier.includes('@')) {
    let query = admin
      .from('profiles')
      .select('id, is_active, tenants!inner (slug, status)')
      .eq('username', identifier.toLowerCase());

    if (tenantSlug) {
      query = query.eq('tenants.slug', tenantSlug);
    }

    const { data: matches } = await query.limit(2);
    if (!matches || matches.length === 0) {
      return { error: 'Username atau kata sandi salah.' };
    }
    if (matches.length > 1) {
      return { error: 'Username ditemukan di beberapa instansi. Mohon isi Kode Instansi.' };
    }
    if (!matches[0].is_active || matches[0].tenants?.status !== 'active') {
      return { error: 'Akun atau instansi Anda tidak aktif. Hubungi administrator.' };
    }

    const { data: authUser } = await admin.auth.admin.getUserById(matches[0].id);
    if (!authUser?.user?.email) {
      return { error: 'Username atau kata sandi salah.' };
    }
    authEmail = authUser.user.email;
  }

  const supabase = await createClient();
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });

  if (signInErr || !signInData.user) {
    return { error: 'Username/email atau kata sandi salah.' };
  }

  // Pastikan profil aktif (kecuali platform admin murni).
  const { data: profile } = await admin
    .from('profiles')
    .select('is_active, must_change_password, tenants!inner (status)')
    .eq('id', signInData.user.id)
    .maybeSingle();

  if (profile && (!profile.is_active || profile.tenants?.status !== 'active')) {
    await supabase.auth.signOut();
    return { error: 'Akun atau instansi Anda dinonaktifkan.' };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
    redirect('/mfa');
  }

  if (profile?.must_change_password) {
    redirect('/pengaturan/keamanan?wajib=1');
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordResetAction(_prevState, formData) {
  const email = String(formData.get('email') || '').trim();
  if (!email || !email.includes('@')) {
    return { error: 'Masukkan alamat email yang valid.' };
  }

  const admin = createAdminClient();
  const ip = await getClientIp();
  const { data: allowed } = await admin.rpc('check_rate_limit', {
    p_key: `reset:${ip}`,
    p_max: 5,
    p_window_seconds: 300,
  });
  if (allowed === false) {
    return { error: 'Terlalu banyak permintaan. Coba lagi beberapa menit lagi.' };
  }

  const supabase = await createClient();
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  // Respons selalu generik agar tidak membocorkan keberadaan akun.
  return {
    success: 'Jika alamat email terdaftar, tautan pengaturan ulang kata sandi telah dikirim.',
  };
}

export async function updatePasswordAction(_prevState, formData) {
  const ctx = await requireAuth({ allowPasswordChange: true });
  const parsed = passwordChangeSchema.safeParse({
    password: String(formData.get('password') || ''),
    confirmPassword: String(formData.get('confirmPassword') || ''),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Kata sandi tidak memenuhi syarat.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: 'Gagal memperbarui kata sandi. Coba lagi.' };
  }

  if (ctx.profile?.must_change_password) {
    const admin = createAdminClient();
    await admin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', ctx.user.id);
  }

  return { success: 'Kata sandi berhasil diperbarui.' };
}

export async function updateProfileAction(_prevState, formData) {
  const ctx = await requireAuth();
  const parsed = profileUpdateSchema.safeParse({
    name: String(formData.get('name') || ''),
    email: String(formData.get('email') || ''),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data profil tidak valid.' };
  }

  const admin = createAdminClient();
  const newEmail = parsed.data.email || null;
  const { error } = await admin
    .from('profiles')
    .update({ name: parsed.data.name, email: newEmail })
    .eq('id', ctx.user.id);

  if (error) {
    return { error: 'Gagal menyimpan perubahan profil.' };
  }

  if (newEmail && newEmail !== ctx.user.email) {
    const supabase = await createClient();
    await supabase.auth.updateUser({ email: newEmail });
  }

  return { success: 'Profil berhasil diperbarui.' };
}

export async function submitTenantRequestAction(_prevState, formData) {
  const parsed = tenantRequestSchema.safeParse({
    org_name: String(formData.get('org_name') || ''),
    slug: String(formData.get('slug') || ''),
    admin_name: String(formData.get('admin_name') || ''),
    admin_email: String(formData.get('admin_email') || ''),
    note: String(formData.get('note') || ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data pendaftaran tidak valid.' };
  }

  const admin = createAdminClient();
  const ip = await getClientIp();
  const { data: allowed } = await admin.rpc('check_rate_limit', {
    p_key: `tenant-req:${ip}`,
    p_max: 5,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    return { error: 'Batas pengajuan pendaftaran tercapai. Coba lagi nanti.' };
  }

  const { data: existingTenant } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', parsed.data.slug)
    .maybeSingle();

  if (existingTenant) {
    return { error: 'Kode instansi tersebut sudah digunakan. Pilih kode lain.' };
  }

  const { error } = await admin.from('tenant_requests').insert({
    org_name: parsed.data.org_name,
    slug: parsed.data.slug,
    admin_name: parsed.data.admin_name,
    admin_email: parsed.data.admin_email,
    note: parsed.data.note || null,
  });

  if (error) {
    if (error.message?.includes('duplicate key')) {
      return { error: 'Pengajuan dengan kode instansi ini sedang menunggu persetujuan.' };
    }
    return { error: 'Gagal mengirim pengajuan. Coba beberapa saat lagi.' };
  }

  return {
    success:
      'Pengajuan instansi berhasil dikirim. Administrator platform akan meninjau dan mengirimkan detail akses melalui email Anda.',
  };
}
