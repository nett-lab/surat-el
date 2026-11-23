'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, hasPermission } from '@/lib/auth/session';
import {
  createUserSchema,
  updateUserSchema,
  positionSchema,
  classificationSchema,
  followupSchema,
  roleSchema,
} from '@/lib/validation/schemas';
import { generateTempPassword } from '@/lib/utils/security';
import { mapRpcError } from '@/lib/utils/format';

export async function createUserAction(payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.pengguna')) {
    return { error: 'Anda tidak memiliki izin mengelola pengguna.' };
  }

  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data pengguna tidak valid.' };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const internalDomain = process.env.INTERNAL_EMAIL_DOMAIN || 'users.esurat.invalid';
  const authEmail =
    parsed.data.email || `${parsed.data.username}.${ctx.tenant.slug}@${internalDomain}`;

  // Pastikan username belum dipakai di tenant ini.
  const { data: dup } = await admin
    .from('profiles')
    .select('id')
    .eq('tenant_id', ctx.tenant.id)
    .eq('username', parsed.data.username)
    .maybeSingle();
  if (dup) {
    return { error: 'Username sudah digunakan di instansi ini.' };
  }

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: authEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: parsed.data.name },
  });

  if (authErr || !created?.user) {
    return { error: 'Gagal membuat akun. Pastikan email belum dipakai akun lain.' };
  }

  const uid = created.user.id;
  const { error: profErr } = await admin.from('profiles').insert({
    id: uid,
    tenant_id: ctx.tenant.id,
    username: parsed.data.username,
    name: parsed.data.name,
    email: parsed.data.email || null,
    is_active: true,
    must_change_password: true,
  });

  if (profErr) {
    await admin.auth.admin.deleteUser(uid);
    return { error: mapRpcError(profErr, 'Gagal menyimpan profil pengguna.') };
  }

  await Promise.all([
    admin.from('position_assignments').insert({
      tenant_id: ctx.tenant.id,
      user_id: uid,
      position_id: parsed.data.position_id,
      is_active: true,
    }),
    admin.from('user_roles').insert({
      tenant_id: ctx.tenant.id,
      user_id: uid,
      role_id: parsed.data.role_id,
    }),
  ]);

  revalidatePath('/master/pengguna');
  return { ok: true, tempPassword, username: parsed.data.username };
}

export async function updateUserAction(userId, payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.pengguna')) {
    return { error: 'Tidak memiliki izin.' };
  }

  const parsed = updateUserSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data tidak valid.' };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('profiles')
    .select('id, tenant_id, user_roles (roles (is_super))')
    .eq('id', userId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle();

  if (!target) return { error: 'Pengguna tidak ditemukan.' };
  if (target.user_roles?.some((ur) => ur.roles?.is_super) && !ctx.isSuper) {
    return { error: 'Akun Super Admin tidak dapat diubah.' };
  }

  const { error } = await admin
    .from('profiles')
    .update({
      name: parsed.data.name,
      username: parsed.data.username,
      email: parsed.data.email || null,
      is_active: parsed.data.is_active,
    })
    .eq('id', userId)
    .eq('tenant_id', ctx.tenant.id);

  if (error) return { error: mapRpcError(error, 'Gagal memperbarui pengguna.') };

  revalidatePath('/master/pengguna');
  return { ok: true };
}

export async function updateUserPositionAction(userId, positionId) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.pengguna')) return { error: 'Tidak memiliki izin.' };

  const admin = createAdminClient();
  await admin
    .from('position_assignments')
    .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
    .eq('tenant_id', ctx.tenant.id)
    .eq('user_id', userId)
    .eq('is_active', true);

  const { error } = await admin.from('position_assignments').insert({
    tenant_id: ctx.tenant.id,
    user_id: userId,
    position_id: positionId,
    is_active: true,
  });

  if (error) return { error: mapRpcError(error, 'Gagal mengubah jabatan.') };
  revalidatePath('/master/pengguna');
  return { ok: true };
}

export async function updateUserRolesAction(userId, roleIds) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.pengguna')) return { error: 'Tidak memiliki izin.' };

  const admin = createAdminClient();
  await admin
    .from('user_roles')
    .delete()
    .eq('tenant_id', ctx.tenant.id)
    .eq('user_id', userId);

  if (Array.isArray(roleIds) && roleIds.length > 0) {
    const rows = roleIds.map((rid) => ({
      tenant_id: ctx.tenant.id,
      user_id: userId,
      role_id: rid,
    }));
    const { error } = await admin.from('user_roles').insert(rows);
    if (error) return { error: mapRpcError(error, 'Gagal memperbarui role.') };
  }

  revalidatePath('/master/pengguna');
  return { ok: true };
}

export async function updateSpecialDispositionsAction(userId, positionIds) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.pengguna')) return { error: 'Tidak memiliki izin.' };

  const admin = createAdminClient();
  const chosen = new Set(positionIds || []);

  const { data: existing } = await admin
    .from('special_disposition_grants')
    .select('id, to_position_id, is_active')
    .eq('tenant_id', ctx.tenant.id)
    .eq('user_id', userId);

  const existingMap = new Map((existing || []).map((e) => [e.to_position_id, e]));

  for (const posId of chosen) {
    const cur = existingMap.get(posId);
    if (cur) {
      if (!cur.is_active) {
        await admin
          .from('special_disposition_grants')
          .update({ is_active: true, revoked_at: null })
          .eq('id', cur.id);
      }
    } else {
      await admin.from('special_disposition_grants').insert({
        tenant_id: ctx.tenant.id,
        user_id: userId,
        to_position_id: posId,
        is_active: true,
      });
    }
  }

  for (const [posId, cur] of existingMap.entries()) {
    if (!chosen.has(posId) && cur.is_active) {
      await admin
        .from('special_disposition_grants')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('id', cur.id);
    }
  }

  revalidatePath('/master/pengguna');
  return { ok: true };
}

export async function savePositionAction(id, payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.jabatan')) return { error: 'Tidak memiliki izin.' };

  const parsed = positionSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Data jabatan tidak valid.' };

  const supabase = await createClient();
  const values = {
    name: parsed.data.name,
    parent_id: parsed.data.parent_id || null,
    is_active: parsed.data.is_active,
  };

  const { error } = id
    ? await supabase.from('positions').update(values).eq('id', id)
    : await supabase.from('positions').insert({ ...values, tenant_id: ctx.tenant.id });

  if (error) return { error: mapRpcError(error, 'Gagal menyimpan jabatan.') };
  revalidatePath('/master/jabatan');
  return { ok: true };
}

export async function saveClassificationAction(id, payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.klasifikasi')) return { error: 'Tidak memiliki izin.' };

  const parsed = classificationSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Data klasifikasi tidak valid.' };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('classifications').update(parsed.data).eq('id', id)
    : await supabase.from('classifications').insert({ ...parsed.data, tenant_id: ctx.tenant.id });

  if (error) return { error: mapRpcError(error, 'Gagal menyimpan kode klasifikasi.') };
  revalidatePath('/master/klasifikasi');
  return { ok: true };
}

export async function saveFollowupAction(id, payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.followup')) return { error: 'Tidak memiliki izin.' };

  const parsed = followupSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Data tindak lanjut tidak valid.' };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('followups').update(parsed.data).eq('id', id)
    : await supabase.from('followups').insert({ ...parsed.data, tenant_id: ctx.tenant.id });

  if (error) return { error: mapRpcError(error, 'Gagal menyimpan tindak lanjut.') };
  revalidatePath('/master/tindak-lanjut');
  return { ok: true };
}

export async function saveRoleAction(id, payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.pengguna')) return { error: 'Tidak memiliki izin.' };

  const parsed = roleSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Data role tidak valid.' };

  const supabase = await createClient();
  let roleId = id;

  if (id) {
    const { error } = await supabase.from('roles').update({ name: parsed.data.name }).eq('id', id);
    if (error) return { error: mapRpcError(error, 'Gagal memperbarui role.') };
    await supabase.from('role_permissions').delete().eq('role_id', id);
  } else {
    const { data, error } = await supabase
      .from('roles')
      .insert({ tenant_id: ctx.tenant.id, name: parsed.data.name, is_super: false })
      .select('id')
      .single();
    if (error) return { error: mapRpcError(error, 'Gagal membuat role.') };
    roleId = data.id;
  }

  if (parsed.data.permissions.length > 0) {
    const rows = parsed.data.permissions.map((k) => ({
      role_id: roleId,
      permission_key: k,
      tenant_id: ctx.tenant.id,
    }));
    const { error } = await supabase.from('role_permissions').insert(rows);
    if (error) return { error: mapRpcError(error, 'Gagal menyimpan daftar izin role.') };
  }

  revalidatePath('/master/role');
  return { ok: true };
}

export async function updateTenantFeaturesAction(features) {
  const ctx = await requireAuth();
  if (!ctx.isSuper) return { error: 'Hanya Super Admin instansi yang dapat mengubah fitur kanal.' };

  const admin = createAdminClient();
  const next = {
    email: Boolean(features?.email),
    telegram: Boolean(features?.telegram),
  };

  const { error } = await admin
    .from('tenants')
    .update({ features: next })
    .eq('id', ctx.tenant.id);

  if (error) return { error: 'Gagal menyimpan konfigurasi fitur.' };
  revalidatePath('/admin/pengiriman');
  revalidatePath('/pengaturan/profil');
  return { ok: true };
}
