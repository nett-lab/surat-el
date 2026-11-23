-- Seeder awal opsional untuk lingkungan lokal/staging.
-- Membuat satu tenant contoh "demo" beserta master data default.
-- Akun pengguna dibuat lewat Supabase Auth (lihat README / halaman pendaftaran atau bootstrap script).

do $$
declare
  v_tenant_id uuid;
begin
  insert into tenants (slug, name, features)
  values ('demo', 'Instansi Demo e-Surat', '{"email": false, "telegram": false}'::jsonb)
  on conflict (slug) do update set name = excluded.name
  returning id into v_tenant_id;

  perform public.seed_tenant_defaults(v_tenant_id);
end $$;
