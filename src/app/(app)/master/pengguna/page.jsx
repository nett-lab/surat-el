import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Button } from '@/components/ui/primitives';
import { UsersClient } from './UsersClient';

export const metadata = { title: 'Master Pengguna' };

export default async function MasterUsersPage() {
  await requirePermission('master.pengguna');
  const supabase = await createClient();

  const [{ data: profiles }, { data: positions }, { data: roles }, { data: assignments }, { data: userRoles }, { data: grants }] =
    await Promise.all([
      supabase.from('profiles').select('id, name, username, email, is_active').order('name'),
      supabase.from('positions').select('id, name').eq('is_active', true).order('name'),
      supabase.from('roles').select('id, name, is_super').order('name'),
      supabase.from('position_assignments').select('user_id, position_id, positions (id, name)').eq('is_active', true),
      supabase.from('user_roles').select('user_id, role_id, roles (id, name)'),
      supabase.from('special_disposition_grants').select('user_id, to_position_id').eq('is_active', true),
    ]);

  const posByUser = new Map((assignments || []).map((a) => [a.user_id, a.positions]));
  const rolesByUser = new Map();
  for (const ur of userRoles || []) {
    const arr = rolesByUser.get(ur.user_id) || [];
    if (ur.roles) arr.push(ur.roles);
    rolesByUser.set(ur.user_id, arr);
  }
  const grantsByUser = new Map();
  for (const g of grants || []) {
    const arr = grantsByUser.get(g.user_id) || [];
    arr.push(g.to_position_id);
    grantsByUser.set(g.user_id, arr);
  }

  const enriched = (profiles || []).map((p) => {
    const uRoles = rolesByUser.get(p.id) || [];
    return {
      ...p,
      activePosition: posByUser.get(p.id) || null,
      roleIds: uRoles.map((r) => r.id),
      roleNames: uRoles.map((r) => r.name),
      specialIds: grantsByUser.get(p.id) || [],
    };
  });

  return (
    <div>
      <PageHeader
        title="Pengguna"
        description="Kelola akun pegawai, jabatan aktif, role, dan hak disposisi khusus."
        actions={
          <Link href="/master">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Master Data
            </Button>
          </Link>
        }
      />
      <UsersClient users={enriched} positions={positions || []} roles={roles || []} />
    </div>
  );
}
