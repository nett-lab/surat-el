-- e-Surat v3: skema inti (multi-tenant, shared database + RLS)
create extension if not exists pgcrypto;
create schema if not exists app;

-- ───────────── Tenant & platform ─────────────
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  features jsonb not null default '{"email": false, "telegram": false}',
  created_at timestamptz not null default now()
);

create table tenant_requests (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  slug text not null,
  admin_name text not null,
  admin_email text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create unique index tenant_requests_pending_slug on tenant_requests (slug) where status = 'pending';

create table platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

-- ───────────── Pengguna, role, izin ─────────────
create table permissions (
  key text primary key,
  label text not null
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  is_super boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table role_permissions (
  role_id uuid not null references roles (id) on delete cascade,
  permission_key text not null references permissions (key) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  primary key (role_id, permission_key)
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._-]{3,50}$'),
  name text not null,
  email text,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  telegram_chat_id text unique,
  created_at timestamptz not null default now(),
  unique (tenant_id, username)
);
create index profiles_tenant on profiles (tenant_id);

create table user_roles (
  user_id uuid not null references profiles (id) on delete cascade,
  role_id uuid not null references roles (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  primary key (user_id, role_id)
);

-- ───────────── Organisasi ─────────────
create table positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  parent_id uuid references positions (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index positions_tenant on positions (tenant_id, parent_id);

create table position_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  position_id uuid not null references positions (id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true
);
create unique index one_active_position_per_user on position_assignments (user_id) where is_active;
create index assignments_position on position_assignments (position_id) where is_active;

create table special_disposition_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  to_position_id uuid not null references positions (id) on delete cascade,
  is_active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, to_position_id)
);

create table classifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null check (code ~ '^[0-9A-Za-z.]{1,10}$'),
  name text not null,
  is_active boolean not null default true,
  unique (tenant_id, code)
);

create table agenda_counters (
  tenant_id uuid not null references tenants (id) on delete cascade,
  classification_id uuid not null references classifications (id) on delete cascade,
  year int not null,
  last_no int not null default 0,
  primary key (tenant_id, classification_id, year)
);

create table followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  is_active boolean not null default true
);

-- ───────────── Surat ─────────────
create table letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  sender text not null check (char_length(sender) <= 150),
  number text check (char_length(number) <= 100),
  letter_date date not null,
  receipt_date date not null,
  subject text not null check (char_length(subject) <= 1000),
  category text not null check (category in ('primary', 'invitation')),
  security_class text not null default 'B' check (security_class in ('SR', 'R', 'T', 'B')),
  received_via text not null default 'other' check (received_via in ('email', 'physical', 'internal', 'other')),
  agenda text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, agenda)
);
create index letters_list on letters (tenant_id, status, category, receipt_date desc) where deleted_at is null;
create index letters_search on letters using gin (
  to_tsvector('simple', coalesce(agenda, '') || ' ' || sender || ' ' || subject || ' ' || coalesce(number, ''))
);

-- Satu tabel untuk distribusi awal, disposisi, dan nota dinas.
create table letter_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  letter_id uuid not null references letters (id) on delete cascade,
  kind text not null check (kind in ('distribution', 'disposition', 'memo')),
  root_flow_id uuid not null,
  from_user_id uuid not null references profiles (id),
  from_position_id uuid not null references positions (id),
  to_position_id uuid not null references positions (id),
  is_cc boolean not null default false,
  is_closing boolean not null default false,
  instruction text check (char_length(instruction) <= 2000),
  followups text[] not null default '{}',
  received_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index flows_inbox on letter_flows (tenant_id, to_position_id, kind, read_at) where deleted_at is null;
create index flows_letter on letter_flows (letter_id, received_at);
create index flows_root on letter_flows (root_flow_id);

create table letter_docs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  letter_id uuid not null references letters (id) on delete cascade,
  name text not null check (char_length(name) <= 255),
  path text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index docs_letter on letter_docs (letter_id) where is_active and deleted_at is null;

create table letter_activities (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id) on delete cascade,
  letter_id uuid not null references letters (id) on delete cascade,
  user_id uuid not null references profiles (id),
  action text not null,
  description text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index activities_letter on letter_activities (letter_id, created_at);

-- ───────────── Notifikasi & antrean (outbox) ─────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  flow_id uuid references letter_flows (id) on delete cascade,
  title text not null,
  body text not null,
  url text not null,
  item_type text not null check (item_type in ('primary', 'invitation', 'disposition', 'memo')),
  security_class text not null default 'B',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on notifications (user_id, read_at, created_at desc);
create index notifications_flow on notifications (flow_id, user_id);

create table notification_jobs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id) on delete cascade,
  notification_id uuid not null references notifications (id) on delete cascade,
  channel text not null check (channel in ('email', 'telegram')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id, channel)
);
create index jobs_due on notification_jobs (status, run_after) where status in ('pending', 'processing');

create table telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- ───────────── Data referensi izin ─────────────
insert into permissions (key, label) values
  ('compose.create', 'Membuka form surat baru'),
  ('compose.store', 'Mendaftarkan surat masuk'),
  ('sent.index', 'Melihat daftar surat terkirim'),
  ('sent.show', 'Melihat detail semua surat'),
  ('sent.edit', 'Membuka form ubah surat'),
  ('sent.update', 'Mengubah/menghapus surat'),
  ('primary.index', 'Inbox utama: daftar'),
  ('primary.show', 'Inbox utama: detail'),
  ('undangan.index', 'Inbox undangan: daftar'),
  ('undangan.show', 'Inbox undangan: detail'),
  ('disposition.index', 'Disposisi: daftar'),
  ('disposition.show', 'Disposisi: detail'),
  ('disposition.create', 'Disposisi: form baru'),
  ('disposition.store', 'Disposisi: kirim'),
  ('memo.index', 'Nota dinas: daftar'),
  ('memo.show', 'Nota dinas: detail'),
  ('memo.create', 'Nota dinas: form baru'),
  ('memo.store', 'Nota dinas: kirim'),
  ('memo.close', 'Menutup surat'),
  ('arsip.index', 'Arsip: daftar'),
  ('arsip.show', 'Arsip: detail'),
  ('master.pengguna', 'Kelola pengguna, role, dan antrean'),
  ('master.jabatan', 'Kelola jabatan'),
  ('master.klasifikasi', 'Kelola klasifikasi arsip'),
  ('master.followup', 'Kelola tindak lanjut');

-- ───────────── Storage & realtime ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('letter-docs', 'letter-docs', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications;
  end if;
exception when duplicate_object then null;
end $$;
