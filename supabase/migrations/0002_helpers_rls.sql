-- Helper otorisasi (schema app, tidak diekspos lewat API) dan kebijakan RLS.
-- Semua helper membaca profil dari auth.uid(), sehingga menonaktifkan pengguna/tenant
-- langsung memutus akses tanpa menunggu token kedaluwarsa.

create or replace function app.tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.tenant_id
  from profiles p join tenants t on t.id = p.tenant_id
  where p.id = auth.uid() and p.is_active and t.status = 'active'
$$;

create or replace function app.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select app.tenant_id() is not null and exists (
    select 1 from user_roles ur join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.is_super)
$$;

create or replace function app.has_perm(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select app.tenant_id() is not null and (
    app.is_super() or exists (
      select 1 from user_roles ur join role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = auth.uid() and rp.permission_key = p_key))
$$;

create or replace function app.my_position() returns uuid
language sql stable security definer set search_path = public as $$
  select position_id from position_assignments where user_id = auth.uid() and is_active limit 1
$$;

create or replace function app.can_access_letter(p_letter uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from letters x
    where x.id = p_letter and x.deleted_at is null and x.tenant_id = app.tenant_id()
      and (x.created_by = auth.uid()
        or app.has_perm('sent.show') or app.has_perm('arsip.show')
        or exists (select 1 from letter_flows f
                   where f.letter_id = x.id and f.deleted_at is null
                     and (f.to_position_id = app.my_position() or f.from_position_id = app.my_position()))))
$$;

-- Penerima akar, atau penerima non-CC disposisi/nota dari akar yang sama.
create or replace function app.can_follow_up(p_root uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.my_position() is not null and exists (
    select 1 from letter_flows f
    where f.root_flow_id = p_root and f.deleted_at is null and f.tenant_id = app.tenant_id()
      and f.to_position_id = app.my_position()
      and (f.kind = 'distribution' or f.is_cc = false))
$$;

grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;

-- ───────────── RLS ─────────────
alter table tenants enable row level security;
alter table tenant_requests enable row level security;
alter table platform_admins enable row level security;
alter table rate_limits enable row level security;
alter table permissions enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table positions enable row level security;
alter table position_assignments enable row level security;
alter table special_disposition_grants enable row level security;
alter table classifications enable row level security;
alter table agenda_counters enable row level security;
alter table followups enable row level security;
alter table letters enable row level security;
alter table letter_flows enable row level security;
alter table letter_docs enable row level security;
alter table letter_activities enable row level security;
alter table notifications enable row level security;
alter table notification_jobs enable row level security;
alter table telegram_link_tokens enable row level security;

-- tenant_requests, platform_admins, rate_limits, agenda_counters, notification_jobs,
-- telegram_link_tokens: tanpa policy = hanya service role.

create policy tenants_read on tenants for select to authenticated using (id = app.tenant_id());
create policy permissions_read on permissions for select to authenticated using (true);

-- Referensi: semua anggota tenant boleh membaca, perubahan butuh izin master.
create policy positions_read on positions for select to authenticated using (tenant_id = app.tenant_id());
create policy positions_write on positions for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.jabatan'))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.jabatan'));

create policy classifications_read on classifications for select to authenticated using (tenant_id = app.tenant_id());
create policy classifications_write on classifications for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.klasifikasi'))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.klasifikasi'));

create policy followups_read on followups for select to authenticated using (tenant_id = app.tenant_id());
create policy followups_write on followups for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.followup'))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.followup'));

create policy roles_read on roles for select to authenticated using (tenant_id = app.tenant_id());
create policy roles_write on roles for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.pengguna') and not is_super)
  with check (tenant_id = app.tenant_id() and app.has_perm('master.pengguna') and not is_super);

create policy role_perms_read on role_permissions for select to authenticated using (tenant_id = app.tenant_id());
create policy role_perms_write on role_permissions for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.pengguna')
         and not exists (select 1 from roles r where r.id = role_id and r.is_super))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.pengguna')
         and not exists (select 1 from roles r where r.id = role_id and r.is_super));

create policy profiles_read on profiles for select to authenticated using (tenant_id = app.tenant_id());
create policy profiles_write on profiles for update to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'));

create policy user_roles_read on user_roles for select to authenticated using (tenant_id = app.tenant_id());
create policy user_roles_write on user_roles for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'));

create policy assignments_read on position_assignments for select to authenticated using (tenant_id = app.tenant_id());
create policy assignments_write on position_assignments for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'));

create policy grants_read on special_disposition_grants for select to authenticated
  using (tenant_id = app.tenant_id() and (user_id = auth.uid() or app.has_perm('master.pengguna')));
create policy grants_write on special_disposition_grants for all to authenticated
  using (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'))
  with check (tenant_id = app.tenant_id() and app.has_perm('master.pengguna'));

-- Surat: baca dibatasi can_access_letter; tulis hanya lewat RPC (security definer).
create policy letters_read on letters for select to authenticated using (app.can_access_letter(id));
create policy flows_read on letter_flows for select to authenticated
  using (deleted_at is null and tenant_id = app.tenant_id()
         and (to_position_id = app.my_position() or app.can_access_letter(letter_id)));
create policy docs_read on letter_docs for select to authenticated
  using (is_active and deleted_at is null and app.can_access_letter(letter_id));
create policy activities_read on letter_activities for select to authenticated
  using (app.can_access_letter(letter_id));

create policy notifications_read on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on notifications for delete to authenticated using (user_id = auth.uid());

-- Pembaruan notifikasi dibatasi ke kolom read_at.
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
revoke insert, update, delete on letters, letter_flows, letter_docs, letter_activities from authenticated;
