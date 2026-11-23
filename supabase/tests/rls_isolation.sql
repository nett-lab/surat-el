-- Uji isolasi multi-tenant RLS & perbaikan audit keamanan (dapat dijalankan via `supabase test db` / psql)
begin;

-- Siapkan dua tenant dan dua user auth.users
insert into tenants (id, slug, name) values
  ('11111111-1111-1111-1111-111111111111', 'instansi-a', 'Instansi A'),
  ('22222222-2222-2222-2222-222222222222', 'instansi-b', 'Instansi B');

select public.seed_tenant_defaults('11111111-1111-1111-1111-111111111111');
select public.seed_tenant_defaults('22222222-2222-2222-2222-222222222222');

insert into auth.users (id, email) values
  ('aaaa1111-1111-1111-1111-111111111111', 'admin-a@example.com'),
  ('bbbb2222-2222-2222-2222-222222222222', 'admin-b@example.com');

insert into profiles (id, tenant_id, username, name, email) values
  ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'admin_a', 'Admin A', 'admin-a@example.com'),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'admin_b', 'Admin B', 'admin-b@example.com');

insert into user_roles (user_id, role_id, tenant_id)
select 'aaaa1111-1111-1111-1111-111111111111', id, tenant_id from roles where tenant_id = '11111111-1111-1111-1111-111111111111' and is_super;
insert into user_roles (user_id, role_id, tenant_id)
select 'bbbb2222-2222-2222-2222-222222222222', id, tenant_id from roles where tenant_id = '22222222-2222-2222-2222-222222222222' and is_super;

insert into position_assignments (tenant_id, user_id, position_id)
select tenant_id, 'aaaa1111-1111-1111-1111-111111111111', id from positions where tenant_id = '11111111-1111-1111-1111-111111111111' limit 1;
insert into position_assignments (tenant_id, user_id, position_id)
select tenant_id, 'bbbb2222-2222-2222-2222-222222222222', id from positions where tenant_id = '22222222-2222-2222-2222-222222222222' limit 1;

-- Simulasikan sesi Admin A dan buat satu surat rahasia (SR)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaa1111-1111-1111-1111-111111111111', true);

do $$
declare
  v_pos uuid;
  v_res jsonb;
begin
  select id into v_pos from positions where tenant_id = '11111111-1111-1111-1111-111111111111' limit 1;
  v_res := public.create_letter(
    jsonb_build_object(
      'sender', 'Kementerian Contoh',
      'number', '001/SR/2026',
      'letter_date', '2026-11-20',
      'receipt_date', '2026-11-21',
      'subject', 'Dokumen Sangat Rahasia',
      'category', 'primary',
      'security_class', 'SR',
      'received_via', 'physical',
      'classification_code', '000',
      'agenda_year', 2026,
      'recipient_position_ids', jsonb_build_array(v_pos)
    ),
    jsonb_build_array(jsonb_build_object(
      'name', 'rahasia.pdf',
      'path', '11111111-1111-1111-1111-111111111111/2026/11/test.pdf'
    ))
  );
  assert (v_res->>'agenda') = '1/000/2026', 'Agenda pertama harus 1/000/2026';
  assert jsonb_array_length(v_res->'job_ids') = 0, 'Surat SR tidak boleh menghasilkan job email/Telegram';
end $$;

-- Pindah sesi ke Admin B: wajib melihat 0 surat milik Tenant A
select set_config('request.jwt.claim.sub', 'bbbb2222-2222-2222-2222-222222222222', true);

do $$
declare
  v_cnt int;
begin
  select count(*) into v_cnt from letters;
  assert v_cnt = 0, 'Kebocoran tenant terdeteksi: Admin B bisa membaca surat Tenant A';
  select count(*) into v_cnt from letter_flows;
  assert v_cnt = 0, 'Kebocoran tenant terdeteksi pada letter_flows';
  select count(*) into v_cnt from letter_docs;
  assert v_cnt = 0, 'Kebocoran tenant terdeteksi pada letter_docs';
end $$;

rollback;
