'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { tenantRequestSchema } from '@/lib/validation/schemas';
import { generateTempPassword } from '@/lib/utils/security';
import { sendTenantWelcomeEmail } from '@/lib/notify/email';

async function provisionTenant({ org_name, slug, admin_name, admin_email, features }) {
  const admin = createAdminClient();

  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .insert({
      slug,
      name: org_name,
      status: 'active',
      features: features || { email: false, telegram: false },
    })
    .select('id, slug, name')
    .single();

  if (tErr || !tenant) {
    return { error: 'Gagal membuat tenant. Pastikan kode instansi belum terpakai.' };
  }

  const { data: seeded, error: seedErr } = await admin.rpc('seed_tenant_defaults', {
    p_tenant_id: tenant.id,
  });
  if (seedErr) {
    await admin.from('tenants').delete().eq('id', tenant.id);
    return { error: 'Gagal menginisialisasi data default instansi.' };
  }

  const tempPassword = generateTempPassword();
  const username = 'superadmin';
  const { data: authCreated, error: authErr } = await admin.auth.admin.createUser({
    email: admin_email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: admin_name },
  });

  if (authErr || !authCreated?.user) {
    await admin.from('tenants').delete().eq('id', tenant.id);
    return { error: 'Gagal membuat akun admin. Pastikan email belum terdaftar.' };
  }

  const uid = authCreated.user.id;
  await admin.from('profiles').insert({
    id: uid,
    tenant_id: tenant.id,
    username,
    name: admin_name,
    email: admin_email,
    is_active: true,
    must_change_password: true,
  });

  await Promise.all([
    admin.from('user_roles').insert({
      tenant_id: tenant.id,
      user_id: uid,
      role_id: seeded.super_role_id,
    }),
    admin.from('position_assignments').insert({
      tenant_id: tenant.id,
      user_id: uid,
      position_id: seeded.default_position_id,
      is_active: true,
    }),
  ]);

  try {
    await sendTenantWelcomeEmail({
      to: admin_email,
      orgName: org_name,
      slug,
      username,
      tempPassword,
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    });
  } catch (err) {
    console.warn('[platform] gagal kirim email sambutan tenant:', err?.message);
  }

  return { ok: true, tenant, username, tempPassword };
}

export async function createTenantManualAction(payload) {
  await requirePlatformAdmin();
  const parsed = tenantRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data instansi tidak valid.' };
  }

  const res = await provisionTenant({
    ...parsed.data,
    features: {
      email: Boolean(payload.enableEmail),
      telegram: Boolean(payload.enableTelegram),
    },
  });

  if (res.ok) revalidatePath('/platform/tenants');
  return res;
}

export async function approveTenantRequestAction(requestId) {
  const ctx = await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: req } = await admin
    .from('tenant_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!req) return { error: 'Pengajuan tidak ditemukan atau sudah diproses.' };

  const res = await provisionTenant({
    org_name: req.org_name,
    slug: req.slug,
    admin_name: req.admin_name,
    admin_email: req.admin_email,
  });
  if (res.error) return res;

  await admin
    .from('tenant_requests')
    .update({
      status: 'approved',
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  revalidatePath('/platform/tenants');
  return res;
}

export async function rejectTenantRequestAction(requestId, reviewNote = '') {
  const ctx = await requirePlatformAdmin();
  const admin = createAdminClient();

  await admin
    .from('tenant_requests')
    .update({
      status: 'rejected',
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  revalidatePath('/platform/tenants');
  return { ok: true };
}

export async function toggleTenantStatusAction(tenantId, nextStatus) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  await admin
    .from('tenants')
    .update({ status: nextStatus === 'suspended' ? 'suspended' : 'active' })
    .eq('id', tenantId);

  revalidatePath('/platform/tenants');
  return { ok: true };
}
