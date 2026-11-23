import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Cek izin exact maupun wildcard (mis. `master.*`).
 */
export function hasPermission(ctx, permission) {
  if (!ctx) return false;
  if (ctx.isSuper) return true;
  if (!permission) return true;
  const list = permission.split('|');
  return list.some((p) => {
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -1);
      return ctx.permissions.some((up) => up.startsWith(prefix));
    }
    return ctx.permissions.includes(p);
  });
}

export const getSessionContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tenant_id, username, name, email, is_active, must_change_password, telegram_chat_id')
    .eq('id', user.id)
    .maybeSingle();

  let isPlatformAdmin = false;
  try {
    const admin = createAdminClient();
    const { data: pa } = await admin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    isPlatformAdmin = Boolean(pa);
  } catch {
    isPlatformAdmin = false;
  }

  if (!profile) {
    if (isPlatformAdmin) {
      return {
        user,
        profile: { id: user.id, name: user.email || 'Platform Admin', username: 'platform', is_active: true },
        tenant: null,
        position: null,
        roles: [],
        permissions: [],
        isSuper: false,
        isPlatformAdmin: true,
        needsMfa: false,
      };
    }
    return null;
  }

  const [{ data: tenant }, { data: assignment }, { data: userRoles }, { data: aalData }] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, slug, name, status, features')
      .eq('id', profile.tenant_id)
      .maybeSingle(),
    supabase
      .from('position_assignments')
      .select('position_id, positions (id, name, parent_id)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role_id, roles (id, name, is_super, role_permissions (permission_key))')
      .eq('user_id', user.id),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (!profile.is_active || !tenant || tenant.status !== 'active') {
    return null;
  }

  const roles = (userRoles || []).map((ur) => ur.roles).filter(Boolean);
  const isSuper = roles.some((r) => r.is_super);
  const permSet = new Set();
  for (const role of roles) {
    for (const rp of role.role_permissions || []) {
      permSet.add(rp.permission_key);
    }
  }

  const needsMfa =
    aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2';

  return {
    user,
    profile,
    tenant,
    position: assignment?.positions || null,
    roles: roles.map((r) => ({ id: r.id, name: r.name, is_super: r.is_super })),
    permissions: Array.from(permSet),
    isSuper,
    isPlatformAdmin,
    needsMfa,
  };
});

export async function requireAuth(options = {}) {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect('/login');
  }
  if (ctx.needsMfa && !options.allowPendingMfa) {
    redirect('/mfa');
  }
  if (ctx.profile?.must_change_password && !options.allowPasswordChange) {
    redirect('/pengaturan/keamanan?wajib=1');
  }
  return ctx;
}

export async function requirePermission(permission) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, permission)) {
    redirect('/dashboard?denied=1');
  }
  return ctx;
}

export async function requirePlatformAdmin() {
  const ctx = await requireAuth({ allowPasswordChange: true });
  if (!ctx.isPlatformAdmin) {
    redirect('/dashboard?denied=1');
  }
  return ctx;
}
