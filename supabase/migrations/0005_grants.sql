-- Perbaikan eksplisit GRANT pada schema public untuk service_role & authenticated.
-- PENTING: Jalankan file ini di Supabase SQL Editor dengan Role = "postgres"
-- (cek dropdown "Role" di bagian atas/bawah SQL Editor sebelum menekan Run).

do $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Role SQL Editor saat ini adalah "%". Ubah dropdown Role di Supabase SQL Editor ke "postgres" lalu jalankan ulang.', current_user;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema app to authenticated, service_role;

-- Service role: akses penuh ke seluruh tabel aplikasi (server-only, worker, migrasi, platform admin)
grant select, insert, update, delete on
  tenants,
  tenant_requests,
  platform_admins,
  rate_limits,
  permissions,
  roles,
  role_permissions,
  profiles,
  user_roles,
  positions,
  position_assignments,
  special_disposition_grants,
  classifications,
  agenda_counters,
  followups,
  letters,
  letter_flows,
  letter_docs,
  letter_activities,
  notifications,
  notification_jobs,
  telegram_link_tokens
to service_role;

-- Sequence untuk tabel berkolom identity (dipakai oleh service_role saat migrasi / worker)
grant usage, select on sequence
  letter_activities_id_seq,
  notification_jobs_id_seq
to service_role;

-- Authenticated: tetap dikunci kebijakan RLS di 0002_helpers_rls.sql
grant select on
  tenants,
  permissions,
  roles,
  role_permissions,
  profiles,
  user_roles,
  positions,
  position_assignments,
  special_disposition_grants,
  classifications,
  followups,
  letters,
  letter_flows,
  letter_docs,
  letter_activities,
  notifications
to authenticated;

grant insert, update, delete on
  roles,
  role_permissions,
  user_roles,
  positions,
  position_assignments,
  special_disposition_grants,
  classifications,
  followups
to authenticated;

grant update on profiles to authenticated;
grant delete on notifications to authenticated;
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

-- Surat & alurnya hanya boleh ditulis lewat RPC security definer di 0003_rpc.sql
revoke insert, update, delete on letters, letter_flows, letter_docs, letter_activities from authenticated;

grant execute on all functions in schema app to authenticated, service_role;
