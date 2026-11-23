-- e-Surat v3: fungsi SQL transaksional (RPC), trigger integritas, dan helper antrean

-- ───────────── Anti-siklus & isolasi tenant pada hierarki jabatan ─────────────
create or replace function app.check_position_hierarchy() returns trigger
language plpgsql set search_path = public as $$
declare
  v_parent_tenant uuid;
  v_has_cycle boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  select tenant_id into v_parent_tenant from positions where id = new.parent_id;
  if v_parent_tenant is null or v_parent_tenant <> new.tenant_id then
    raise exception 'POSITION_PARENT_INVALID';
  end if;

  with recursive chain as (
    select id, parent_id from positions where id = new.parent_id
    union all
    select p.id, p.parent_id from positions p join chain c on p.id = c.parent_id
  )
  select exists(select 1 from chain where id = new.id) into v_has_cycle;

  if v_has_cycle then
    raise exception 'POSITION_CYCLE_DETECTED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_positions_hierarchy on positions;
create trigger trg_positions_hierarchy
before insert or update of parent_id on positions
for each row execute function app.check_position_hierarchy();

-- ───────────── Helper internal: buat notifikasi in-app + outbox job ─────────────
create or replace function app.enqueue_flow_notifications(p_flow_id uuid) returns bigint[]
language plpgsql security definer set search_path = public as $$
declare
  v_flow letter_flows%rowtype;
  v_letter letters%rowtype;
  v_features jsonb;
  v_restricted boolean;
  v_item_type text;
  v_title text;
  v_body text;
  v_url text;
  v_user record;
  v_notif_id uuid;
  v_job_id bigint;
  v_job_ids bigint[] := '{}';
begin
  select * into v_flow from letter_flows where id = p_flow_id and deleted_at is null;
  if not found then
    return v_job_ids;
  end if;

  select * into v_letter from letters where id = v_flow.letter_id and deleted_at is null;
  if not found then
    return v_job_ids;
  end if;

  select features into v_features from tenants where id = v_flow.tenant_id;
  v_restricted := v_letter.security_class in ('SR', 'R', 'T');

  if v_flow.kind = 'distribution' then
    v_item_type := v_letter.category;
    v_title := case when v_letter.category = 'invitation' then 'Surat Undangan' else 'Surat Masuk Utama' end;
    v_url := case when v_letter.category = 'invitation'
      then '/inbox/undangan/' || v_flow.id
      else '/inbox/utama/' || v_flow.id
    end;
  elsif v_flow.kind = 'disposition' then
    v_item_type := 'disposition';
    v_title := 'Disposisi';
    v_url := '/disposisi/' || v_flow.id;
  else
    v_item_type := 'memo';
    v_title := case when v_flow.is_closing then 'Nota Dinas Penutupan' else 'Nota Dinas' end;
    v_url := '/nota-dinas/' || v_flow.id;
  end if;

  v_body := case when v_restricted then '(perihal dirahasiakan)' else v_letter.subject end;

  for v_user in
    select p.id, p.email, p.telegram_chat_id
    from position_assignments pa
    join profiles p on p.id = pa.user_id
    where pa.position_id = v_flow.to_position_id
      and pa.tenant_id = v_flow.tenant_id
      and pa.is_active = true
      and p.is_active = true
  loop
    insert into notifications (
      tenant_id, user_id, flow_id, title, body, url, item_type, security_class
    ) values (
      v_flow.tenant_id, v_user.id, v_flow.id, v_title, v_body, v_url, v_item_type, v_letter.security_class
    ) returning id into v_notif_id;

    -- Surat SR/R/T dilarang dikirim lewat kanal eksternal (email/Telegram).
    if not v_restricted then
      if coalesce((v_features->>'email')::boolean, false)
         and v_user.email is not null
         and v_user.email <> ''
         and v_user.email not like '%.invalid' then
        insert into notification_jobs (tenant_id, notification_id, channel)
        values (v_flow.tenant_id, v_notif_id, 'email')
        on conflict (notification_id, channel) do nothing
        returning id into v_job_id;
        if v_job_id is not null then
          v_job_ids := array_append(v_job_ids, v_job_id);
        end if;
      end if;

      if coalesce((v_features->>'telegram')::boolean, false)
         and v_user.telegram_chat_id is not null
         and v_user.telegram_chat_id <> '' then
        insert into notification_jobs (tenant_id, notification_id, channel)
        values (v_flow.tenant_id, v_notif_id, 'telegram')
        on conflict (notification_id, channel) do nothing
        returning id into v_job_id;
        if v_job_id is not null then
          v_job_ids := array_append(v_job_ids, v_job_id);
        end if;
      end if;
    end if;
  end loop;

  return v_job_ids;
end;
$$;

-- ───────────── Target disposisi yang diizinkan (bawahan + hak khusus) ─────────────
create or replace function public.allowed_disposition_targets()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name
  from positions p
  where p.tenant_id = app.tenant_id()
    and p.is_active = true
    and (
      p.parent_id = app.my_position()
      or exists (
        select 1 from special_disposition_grants g
        where g.tenant_id = app.tenant_id()
          and g.user_id = auth.uid()
          and g.to_position_id = p.id
          and g.is_active = true
      )
    )
  order by p.name asc
$$;

-- ───────────── Compose surat masuk baru (atomik) ─────────────
create or replace function public.create_letter(
  p_payload jsonb,
  p_docs jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_uid uuid := auth.uid();
  v_pos uuid := app.my_position();
  v_class classifications%rowtype;
  v_year int;
  v_seq int;
  v_agenda text;
  v_letter_id uuid;
  v_recipient_id uuid;
  v_flow_id uuid;
  v_doc jsonb;
  v_doc_path text;
  v_job_ids bigint[] := '{}';
  v_new_jobs bigint[];
  v_recipients uuid[];
begin
  if v_tenant is null or not app.has_perm('compose.store') then
    raise exception 'FORBIDDEN';
  end if;
  if v_pos is null then
    raise exception 'NO_ACTIVE_POSITION';
  end if;

  v_year := (p_payload->>'agenda_year')::int;
  if v_year is null or v_year < 1990 or v_year > 2100 then
    raise exception 'INVALID_AGENDA_YEAR';
  end if;

  select * into v_class
  from classifications
  where tenant_id = v_tenant and code = (p_payload->>'classification_code') and is_active = true;
  if not found then
    raise exception 'INVALID_CLASSIFICATION';
  end if;

  select array_agg(distinct x::uuid) into v_recipients
  from jsonb_array_elements_text(coalesce(p_payload->'recipient_position_ids', '[]'::jsonb)) x;

  if v_recipients is null or array_length(v_recipients, 1) < 1 then
    raise exception 'RECIPIENTS_REQUIRED';
  end if;

  if exists (
    select 1 from unnest(v_recipients) r
    where not exists (
      select 1 from positions p where p.id = r and p.tenant_id = v_tenant and p.is_active = true
    )
  ) then
    raise exception 'INVALID_RECIPIENT_POSITION';
  end if;

  if p_docs is null or jsonb_typeof(p_docs) <> 'array' or jsonb_array_length(p_docs) < 1 then
    raise exception 'DOCS_REQUIRED';
  end if;

  insert into agenda_counters (tenant_id, classification_id, year, last_no)
  values (v_tenant, v_class.id, v_year, 1)
  on conflict (tenant_id, classification_id, year)
  do update set last_no = agenda_counters.last_no + 1
  returning last_no into v_seq;

  v_agenda := v_seq || '/' || v_class.code || '/' || v_year;

  insert into letters (
    tenant_id, sender, number, letter_date, receipt_date, subject,
    category, security_class, received_via, agenda, status, created_by
  ) values (
    v_tenant,
    trim(p_payload->>'sender'),
    nullif(trim(coalesce(p_payload->>'number', '')), ''),
    (p_payload->>'letter_date')::date,
    (p_payload->>'receipt_date')::date,
    trim(p_payload->>'subject'),
    p_payload->>'category',
    coalesce(p_payload->>'security_class', 'B'),
    coalesce(p_payload->>'received_via', 'other'),
    v_agenda,
    'open',
    v_uid
  ) returning id into v_letter_id;

  insert into letter_activities (tenant_id, letter_id, user_id, action, description, changes)
  values (
    v_tenant, v_letter_id, v_uid, 'register_incoming', 'Mendaftarkan surat masuk',
    jsonb_build_object(
      'category', p_payload->>'category',
      'security_class', coalesce(p_payload->>'security_class', 'B'),
      'received_via', coalesce(p_payload->>'received_via', 'other'),
      'agenda', v_agenda
    )
  );

  foreach v_recipient_id in array v_recipients loop
    v_flow_id := gen_random_uuid();
    insert into letter_flows (
      id, tenant_id, letter_id, kind, root_flow_id,
      from_user_id, from_position_id, to_position_id, instruction, received_at
    ) values (
      v_flow_id, v_tenant, v_letter_id, 'distribution', v_flow_id,
      v_uid, v_pos, v_recipient_id,
      nullif(trim(coalesce(p_payload->>'instruction', '')), ''),
      now()
    );
    v_new_jobs := app.enqueue_flow_notifications(v_flow_id);
    v_job_ids := v_job_ids || v_new_jobs;
  end loop;

  for v_doc in select * from jsonb_array_elements(p_docs) loop
    v_doc_path := v_doc->>'path';
    if v_doc_path is null or left(v_doc_path, 37) <> (v_tenant::text || '/') then
      raise exception 'INVALID_DOC_PATH';
    end if;
    insert into letter_docs (tenant_id, letter_id, name, path)
    values (v_tenant, v_letter_id, trim(v_doc->>'name'), v_doc_path);
  end loop;

  return jsonb_build_object(
    'letter_id', v_letter_id,
    'agenda', v_agenda,
    'job_ids', to_jsonb(v_job_ids)
  );
end;
$$;

-- ───────────── Buat tindak lanjut (disposisi / nota dinas) ─────────────
create or replace function public.create_flow(
  p_kind text,
  p_root_flow_id uuid,
  p_to_positions uuid[],
  p_cc_positions uuid[] default '{}',
  p_instruction text default null,
  p_followups text[] default '{}',
  p_docs jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_uid uuid := auth.uid();
  v_pos uuid := app.my_position();
  v_root letter_flows%rowtype;
  v_letter letters%rowtype;
  v_target uuid;
  v_flow_id uuid;
  v_doc jsonb;
  v_doc_path text;
  v_job_ids bigint[] := '{}';
  v_new_jobs bigint[];
  v_all_targets uuid[];
begin
  if v_tenant is null then
    raise exception 'FORBIDDEN';
  end if;
  if v_pos is null then
    raise exception 'NO_ACTIVE_POSITION';
  end if;
  if p_kind not in ('disposition', 'memo') then
    raise exception 'INVALID_FLOW_KIND';
  end if;
  if p_kind = 'disposition' and not app.has_perm('disposition.store') then
    raise exception 'FORBIDDEN';
  end if;
  if p_kind = 'memo' and not app.has_perm('memo.store') then
    raise exception 'FORBIDDEN';
  end if;

  if not app.can_follow_up(p_root_flow_id) then
    raise exception 'FOLLOWUP_NOT_AUTHORIZED';
  end if;

  select * into v_root
  from letter_flows
  where id = p_root_flow_id and tenant_id = v_tenant and kind = 'distribution' and deleted_at is null;
  if not found then
    raise exception 'ROOT_FLOW_NOT_FOUND';
  end if;

  select * into v_letter
  from letters
  where id = v_root.letter_id and tenant_id = v_tenant and status = 'open' and deleted_at is null;
  if not found then
    raise exception 'LETTER_CLOSED_OR_NOT_FOUND';
  end if;

  if p_to_positions is null or array_length(p_to_positions, 1) < 1 then
    raise exception 'RECIPIENTS_REQUIRED';
  end if;

  v_all_targets := p_to_positions || coalesce(p_cc_positions, '{}');

  if p_kind = 'disposition' then
    if exists (
      select 1 from unnest(v_all_targets) t
      where t not in (select id from public.allowed_disposition_targets())
    ) then
      raise exception 'DISPOSITION_TARGET_NOT_ALLOWED';
    end if;
  else
    if exists (
      select 1 from unnest(v_all_targets) t
      where not exists (
        select 1 from positions p where p.id = t and p.tenant_id = v_tenant and p.is_active = true
      )
    ) then
      raise exception 'INVALID_TARGET_POSITION';
    end if;
  end if;

  foreach v_target in array (select array_agg(distinct x) from unnest(p_to_positions) x) loop
    v_flow_id := gen_random_uuid();
    insert into letter_flows (
      id, tenant_id, letter_id, kind, root_flow_id,
      from_user_id, from_position_id, to_position_id,
      is_cc, instruction, followups, received_at
    ) values (
      v_flow_id, v_tenant, v_letter.id, p_kind, v_root.id,
      v_uid, v_pos, v_target,
      false, nullif(trim(coalesce(p_instruction, '')), ''), coalesce(p_followups, '{}'), now()
    );
    v_new_jobs := app.enqueue_flow_notifications(v_flow_id);
    v_job_ids := v_job_ids || v_new_jobs;
  end loop;

  if p_cc_positions is not null and array_length(p_cc_positions, 1) > 0 then
    foreach v_target in array (
      select array_agg(distinct x) from unnest(p_cc_positions) x where x <> all(p_to_positions)
    ) loop
      if v_target is null then continue; end if;
      v_flow_id := gen_random_uuid();
      insert into letter_flows (
        id, tenant_id, letter_id, kind, root_flow_id,
        from_user_id, from_position_id, to_position_id,
        is_cc, received_at
      ) values (
        v_flow_id, v_tenant, v_letter.id, p_kind, v_root.id,
        v_uid, v_pos, v_target, true, now()
      );
      v_new_jobs := app.enqueue_flow_notifications(v_flow_id);
      v_job_ids := v_job_ids || v_new_jobs;
    end loop;
  end if;

  if p_docs is not null and jsonb_typeof(p_docs) = 'array' then
    for v_doc in select * from jsonb_array_elements(p_docs) loop
      v_doc_path := v_doc->>'path';
      if v_doc_path is null or left(v_doc_path, 37) <> (v_tenant::text || '/') then
        raise exception 'INVALID_DOC_PATH';
      end if;
      insert into letter_docs (tenant_id, letter_id, name, path)
      values (v_tenant, v_letter.id, trim(v_doc->>'name'), v_doc_path);
    end loop;
  end if;

  insert into letter_activities (tenant_id, letter_id, user_id, action, description, changes)
  values (
    v_tenant, v_letter.id, v_uid,
    case when p_kind = 'disposition' then 'create_disposition' else 'create_memo' end,
    case when p_kind = 'disposition' then 'Mengirim disposisi' else 'Mengirim nota dinas' end,
    jsonb_build_object('target_count', array_length(p_to_positions, 1))
  );

  return jsonb_build_object('ok', true, 'letter_id', v_letter.id, 'job_ids', to_jsonb(v_job_ids));
end;
$$;

-- ───────────── Penutupan surat lewat nota dinas (perbaikan temuan #1) ─────────────
create or replace function public.close_letter(
  p_memo_flow_id uuid,
  p_to_position_id uuid,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_uid uuid := auth.uid();
  v_pos uuid := app.my_position();
  v_memo letter_flows%rowtype;
  v_letter letters%rowtype;
  v_close_id uuid;
  v_job_ids bigint[];
begin
  if v_tenant is null or not app.has_perm('memo.close') then
    raise exception 'FORBIDDEN';
  end if;
  if v_pos is null then
    raise exception 'NO_ACTIVE_POSITION';
  end if;

  select * into v_memo
  from letter_flows
  where id = p_memo_flow_id
    and tenant_id = v_tenant
    and kind = 'memo'
    and to_position_id = v_pos
    and is_cc = false
    and deleted_at is null;
  if not found then
    raise exception 'MEMO_NOT_OWNED';
  end if;

  select * into v_letter
  from letters
  where id = v_memo.letter_id and tenant_id = v_tenant and status = 'open' and deleted_at is null
  for update;
  if not found then
    raise exception 'LETTER_ALREADY_CLOSED';
  end if;

  if not exists (
    select 1 from positions where id = p_to_position_id and tenant_id = v_tenant and is_active = true
  ) then
    raise exception 'INVALID_TARGET_POSITION';
  end if;

  v_close_id := gen_random_uuid();
  insert into letter_flows (
    id, tenant_id, letter_id, kind, root_flow_id,
    from_user_id, from_position_id, to_position_id,
    is_cc, is_closing, instruction, received_at
  ) values (
    v_close_id, v_tenant, v_letter.id, 'memo', v_memo.root_flow_id,
    v_uid, v_pos, p_to_position_id,
    false, true, nullif(trim(coalesce(p_note, '')), ''), now()
  );

  update letters set status = 'closed', updated_at = now() where id = v_letter.id;

  insert into letter_activities (tenant_id, letter_id, user_id, action, description, changes)
  values (
    v_tenant, v_letter.id, v_uid, 'close_letter', 'Menutup surat dan memindahkan ke arsip',
    jsonb_build_object('closing_flow_id', v_close_id)
  );

  v_job_ids := app.enqueue_flow_notifications(v_close_id);

  return jsonb_build_object('ok', true, 'letter_id', v_letter.id, 'job_ids', to_jsonb(v_job_ids));
end;
$$;

-- ───────────── Tandai dibaca + sinkronisasi notifikasi dua arah (perbaikan #2 & #9) ─────────────
create or replace function public.mark_flow_read(p_flow_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_uid uuid := auth.uid();
  v_pos uuid := app.my_position();
  v_flow letter_flows%rowtype;
  v_was_unread boolean;
begin
  if v_tenant is null or v_pos is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_flow
  from letter_flows
  where id = p_flow_id and tenant_id = v_tenant and to_position_id = v_pos and deleted_at is null;
  if not found then
    raise exception 'FLOW_NOT_OWNED';
  end if;

  v_was_unread := v_flow.read_at is null;
  if v_was_unread then
    update letter_flows set read_at = now() where id = v_flow.id;
    if v_flow.kind = 'distribution' then
      insert into letter_activities (tenant_id, letter_id, user_id, action, description, changes)
      values (v_tenant, v_flow.letter_id, v_uid, 'read_inbox', 'Membaca surat masuk',
              jsonb_build_object('flow_id', v_flow.id));
    end if;
  end if;

  update notifications
  set read_at = now()
  where user_id = v_uid and flow_id = v_flow.id and read_at is null;

  return v_was_unread;
end;
$$;

create or replace function public.mark_notification_open(p_notification_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_notif notifications%rowtype;
  v_pos uuid := app.my_position();
begin
  select * into v_notif
  from notifications
  where id = p_notification_id and user_id = auth.uid();
  if not found then
    raise exception 'NOTIFICATION_NOT_FOUND';
  end if;

  if v_notif.read_at is null then
    update notifications set read_at = now() where id = v_notif.id;
  end if;

  if v_notif.flow_id is not null and v_pos is not null then
    if exists (
      select 1 from letter_flows
      where id = v_notif.flow_id and to_position_id = v_pos and read_at is null and deleted_at is null
    ) then
      perform public.mark_flow_read(v_notif.flow_id);
    end if;
  end if;

  return v_notif.url;
end;
$$;

create or replace function public.mark_all_notifications_read() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pos uuid := app.my_position();
  v_flow_id uuid;
begin
  if v_pos is not null then
    for v_flow_id in
      select distinct n.flow_id
      from notifications n
      join letter_flows f on f.id = n.flow_id
      where n.user_id = v_uid and n.read_at is null
        and f.to_position_id = v_pos and f.read_at is null and f.deleted_at is null
    loop
      perform public.mark_flow_read(v_flow_id);
    end loop;
  end if;

  update notifications set read_at = now() where user_id = v_uid and read_at is null;
end;
$$;

-- ───────────── Ubah surat terkirim (metadata, penerima, lampiran, hapus) ─────────────
create or replace function public.update_letter_meta(p_letter_id uuid, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_uid uuid := auth.uid();
  v_old letters%rowtype;
  v_changes jsonb := '{}'::jsonb;
begin
  if v_tenant is null or not app.has_perm('sent.update') then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_old from letters
  where id = p_letter_id and tenant_id = v_tenant and status = 'open' and deleted_at is null
  for update;
  if not found then
    raise exception 'LETTER_NOT_EDITABLE';
  end if;

  if v_old.sender is distinct from trim(p_payload->>'sender') then
    v_changes := v_changes || jsonb_build_object('sender', jsonb_build_object('old', v_old.sender, 'new', trim(p_payload->>'sender')));
  end if;
  if v_old.number is distinct from nullif(trim(coalesce(p_payload->>'number', '')), '') then
    v_changes := v_changes || jsonb_build_object('number', jsonb_build_object('old', v_old.number, 'new', nullif(trim(coalesce(p_payload->>'number', '')), '')));
  end if;
  if v_old.letter_date is distinct from (p_payload->>'letter_date')::date then
    v_changes := v_changes || jsonb_build_object('letter_date', jsonb_build_object('old', v_old.letter_date, 'new', p_payload->>'letter_date'));
  end if;
  if v_old.receipt_date is distinct from (p_payload->>'receipt_date')::date then
    v_changes := v_changes || jsonb_build_object('receipt_date', jsonb_build_object('old', v_old.receipt_date, 'new', p_payload->>'receipt_date'));
  end if;
  if v_old.category is distinct from (p_payload->>'category') then
    v_changes := v_changes || jsonb_build_object('category', jsonb_build_object('old', v_old.category, 'new', p_payload->>'category'));
  end if;
  if v_old.security_class is distinct from coalesce(p_payload->>'security_class', v_old.security_class) then
    v_changes := v_changes || jsonb_build_object('security_class', jsonb_build_object('old', v_old.security_class, 'new', p_payload->>'security_class'));
  end if;
  if v_old.received_via is distinct from coalesce(p_payload->>'received_via', v_old.received_via) then
    v_changes := v_changes || jsonb_build_object('received_via', jsonb_build_object('old', v_old.received_via, 'new', p_payload->>'received_via'));
  end if;
  if v_old.subject is distinct from trim(p_payload->>'subject') then
    v_changes := v_changes || jsonb_build_object('subject', jsonb_build_object('old', v_old.subject, 'new', trim(p_payload->>'subject')));
  end if;

  update letters set
    sender = trim(p_payload->>'sender'),
    number = nullif(trim(coalesce(p_payload->>'number', '')), ''),
    letter_date = (p_payload->>'letter_date')::date,
    receipt_date = (p_payload->>'receipt_date')::date,
    category = p_payload->>'category',
    security_class = coalesce(p_payload->>'security_class', security_class),
    received_via = coalesce(p_payload->>'received_via', received_via),
    subject = trim(p_payload->>'subject'),
    updated_at = now()
  where id = v_old.id;

  if v_changes <> '{}'::jsonb then
    insert into letter_activities (tenant_id, letter_id, user_id, action, description, changes)
    values (v_tenant, v_old.id, v_uid, 'update_letter', 'Memperbarui data surat', v_changes);
  end if;
end;
$$;

create or replace function public.update_letter_recipients(p_letter_id uuid, p_recipients jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_uid uuid := auth.uid();
  v_pos uuid := app.my_position();
  v_keep_ids uuid[];
  v_item jsonb;
  v_existing letter_flows%rowtype;
  v_new_id uuid;
  v_to_pos uuid;
  v_removed text[];
  v_added text[] := '{}';
  v_reassigned text[] := '{}';
  v_pos_name text;
  v_job_ids bigint[] := '{}';
  v_changes jsonb := '{}'::jsonb;
begin
  if v_tenant is null or not app.has_perm('sent.update') then
    raise exception 'FORBIDDEN';
  end if;
  if v_pos is null then
    raise exception 'NO_ACTIVE_POSITION';
  end if;

  if not exists (
    select 1 from letters where id = p_letter_id and tenant_id = v_tenant and status = 'open' and deleted_at is null
  ) then
    raise exception 'LETTER_NOT_EDITABLE';
  end if;

  if exists (
    select 1 from letter_flows
    where letter_id = p_letter_id and kind in ('disposition', 'memo') and deleted_at is null
  ) then
    raise exception 'LETTER_HAS_FOLLOWUPS';
  end if;

  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array' or jsonb_array_length(p_recipients) < 1 then
    raise exception 'RECIPIENTS_REQUIRED';
  end if;

  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_keep_ids
  from jsonb_array_elements(p_recipients) x
  where nullif(x->>'id', '') is not null;

  -- Hitung penerima yang dihapus secara akurat di dalam transaksi (perbaikan temuan #8).
  with removed as (
    update letter_flows f
    set deleted_at = now()
    where f.letter_id = p_letter_id
      and f.kind = 'distribution'
      and f.deleted_at is null
      and not (f.id = any(v_keep_ids))
    returning f.to_position_id
  )
  select coalesce(array_agg(p.name), '{}') into v_removed
  from removed r join positions p on p.id = r.to_position_id;

  for v_item in select * from jsonb_array_elements(p_recipients) loop
    v_to_pos := (v_item->>'to_position_id')::uuid;
    select name into v_pos_name from positions
    where id = v_to_pos and tenant_id = v_tenant and is_active = true;
    if v_pos_name is null then
      raise exception 'INVALID_RECIPIENT_POSITION';
    end if;

    if nullif(v_item->>'id', '') is not null then
      select * into v_existing from letter_flows
      where id = (v_item->>'id')::uuid and letter_id = p_letter_id and kind = 'distribution' and deleted_at is null;
      if found then
        if v_existing.to_position_id <> v_to_pos then
          update letter_flows set
            to_position_id = v_to_pos,
            instruction = nullif(trim(coalesce(v_item->>'instruction', '')), ''),
            received_at = now(),
            read_at = null
          where id = v_existing.id;
          v_reassigned := array_append(v_reassigned, v_pos_name);
          v_job_ids := v_job_ids || app.enqueue_flow_notifications(v_existing.id);
        else
          update letter_flows set
            instruction = nullif(trim(coalesce(v_item->>'instruction', '')), '')
          where id = v_existing.id;
        end if;
      end if;
    else
      v_new_id := gen_random_uuid();
      insert into letter_flows (
        id, tenant_id, letter_id, kind, root_flow_id,
        from_user_id, from_position_id, to_position_id, instruction, received_at
      ) values (
        v_new_id, v_tenant, p_letter_id, 'distribution', v_new_id,
        v_uid, v_pos, v_to_pos,
        nullif(trim(coalesce(v_item->>'instruction', '')), ''), now()
      );
      v_added := array_append(v_added, v_pos_name);
      v_job_ids := v_job_ids || app.enqueue_flow_notifications(v_new_id);
    end if;
  end loop;

  if array_length(v_removed, 1) > 0 then
    v_changes := v_changes || jsonb_build_object('removed', to_jsonb(v_removed));
  end if;
  if array_length(v_added, 1) > 0 then
    v_changes := v_changes || jsonb_build_object('added', to_jsonb(v_added));
  end if;
  if array_length(v_reassigned, 1) > 0 then
    v_changes := v_changes || jsonb_build_object('reassigned', to_jsonb(v_reassigned));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into letter_activities (tenant_id, letter_id, user_id, action, description, changes)
    values (v_tenant, p_letter_id, v_uid, 'update_recipients', 'Memperbarui data penerima surat', v_changes);
  end if;

  return jsonb_build_object('ok', true, 'job_ids', to_jsonb(v_job_ids));
end;
$$;

create or replace function public.update_letter_docs(
  p_letter_id uuid,
  p_remove_ids uuid[] default '{}',
  p_add_docs jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_uid uuid := auth.uid();
  v_removed_names text[] := '{}';
  v_removed_paths text[] := '{}';
  v_added_names text[] := '{}';
  v_doc jsonb;
  v_doc_path text;
  v_changes jsonb := '{}'::jsonb;
begin
  if v_tenant is null or not app.has_perm('sent.update') then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from letters where id = p_letter_id and tenant_id = v_tenant and status = 'open' and deleted_at is null
  ) then
    raise exception 'LETTER_NOT_EDITABLE';
  end if;

  if p_remove_ids is not null and array_length(p_remove_ids, 1) > 0 then
    with deactivated as (
      update letter_docs
      set is_active = false, deleted_at = now()
      where letter_id = p_letter_id and tenant_id = v_tenant and is_active = true and id = any(p_remove_ids)
      returning name, path
    )
    select coalesce(array_agg(name), '{}'), coalesce(array_agg(path), '{}')
    into v_removed_names, v_removed_paths
    from deactivated;
  end if;

  if p_add_docs is not null and jsonb_typeof(p_add_docs) = 'array' then
    for v_doc in select * from jsonb_array_elements(p_add_docs) loop
      v_doc_path := v_doc->>'path';
      if v_doc_path is null or left(v_doc_path, 37) <> (v_tenant::text || '/') then
        raise exception 'INVALID_DOC_PATH';
      end if;
      insert into letter_docs (tenant_id, letter_id, name, path)
      values (v_tenant, p_letter_id, trim(v_doc->>'name'), v_doc_path);
      v_added_names := array_append(v_added_names, trim(v_doc->>'name'));
    end loop;
  end if;

  if array_length(v_removed_names, 1) > 0 then
    v_changes := v_changes || jsonb_build_object('removed', to_jsonb(v_removed_names));
  end if;
  if array_length(v_added_names, 1) > 0 then
    v_changes := v_changes || jsonb_build_object('added', to_jsonb(v_added_names));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into letter_activities (tenant_id, letter_id, user_id, action, description, changes)
    values (v_tenant, p_letter_id, v_uid, 'update_docs', 'Memperbarui lampiran surat', v_changes);
  end if;

  return jsonb_build_object('ok', true, 'removed_paths', to_jsonb(v_removed_paths));
end;
$$;

create or replace function public.delete_letter(p_letter_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
begin
  if v_tenant is null or not app.has_perm('sent.update') then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (select 1 from letters where id = p_letter_id and tenant_id = v_tenant and deleted_at is null) then
    raise exception 'LETTER_NOT_FOUND';
  end if;

  update letter_flows set deleted_at = now() where letter_id = p_letter_id and deleted_at is null;
  update letter_docs set deleted_at = now(), is_active = false where letter_id = p_letter_id and deleted_at is null;
  update letters set deleted_at = now(), updated_at = now() where id = p_letter_id;
end;
$$;

-- ───────────── Ringkasan badge inbox & dashboard ─────────────
create or replace function public.inbox_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  with pos as (select app.my_position() as pid, app.tenant_id() as tid)
  select jsonb_build_object(
    'primary', coalesce((
      select count(*) from letter_flows f join letters l on l.id = f.letter_id, pos
      where pos.pid is not null and f.tenant_id = pos.tid and f.to_position_id = pos.pid
        and f.kind = 'distribution' and f.read_at is null and f.deleted_at is null
        and l.category = 'primary' and l.deleted_at is null
    ), 0),
    'invitation', coalesce((
      select count(*) from letter_flows f join letters l on l.id = f.letter_id, pos
      where pos.pid is not null and f.tenant_id = pos.tid and f.to_position_id = pos.pid
        and f.kind = 'distribution' and f.read_at is null and f.deleted_at is null
        and l.category = 'invitation' and l.deleted_at is null
    ), 0),
    'disposition', coalesce((
      select count(*) from letter_flows f, pos
      where pos.pid is not null and f.tenant_id = pos.tid and f.to_position_id = pos.pid
        and f.kind = 'disposition' and f.read_at is null and f.deleted_at is null
    ), 0),
    'memo', coalesce((
      select count(*) from letter_flows f, pos
      where pos.pid is not null and f.tenant_id = pos.tid and f.to_position_id = pos.pid
        and f.kind = 'memo' and f.read_at is null and f.deleted_at is null
    ), 0),
    'unread_notifications', coalesce((
      select count(*) from notifications where user_id = auth.uid() and read_at is null
    ), 0)
  )
$$;

create or replace function public.dashboard_summary(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := app.tenant_id();
  v_pos uuid := app.my_position();
  v_days int := case when p_days in (7, 30, 90) then p_days else 90 end;
  v_start date := current_date - (v_days - 1);
  v_mode text;
  v_stats jsonb;
  v_series jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('mode', 'user', 'stats', '{}'::jsonb, 'series', '[]'::jsonb);
  end if;

  if app.is_super() then
    v_mode := 'admin';
    v_stats := jsonb_build_object(
      'active_users', (select count(*) from profiles where tenant_id = v_tenant and is_active),
      'active_positions', (select count(*) from positions where tenant_id = v_tenant and is_active),
      'total_letters', (select count(*) from letters where tenant_id = v_tenant and deleted_at is null),
      'open_letters', (select count(*) from letters where tenant_id = v_tenant and status = 'open' and deleted_at is null)
    );
    select coalesce(jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'surat_masuk', coalesce(c.cnt, 0)) order by d), '[]'::jsonb)
    into v_series
    from generate_series(v_start, current_date, interval '1 day') d
    left join (
      select receipt_date, count(*) cnt
      from letters where tenant_id = v_tenant and deleted_at is null and receipt_date >= v_start
      group by receipt_date
    ) c on c.receipt_date = d::date;
  elsif app.has_perm('sent.index') then
    v_mode := 'manager';
    v_stats := jsonb_build_object(
      'total_incoming', (select count(*) from letters where tenant_id = v_tenant and deleted_at is null),
      'open_letters', (select count(*) from letters where tenant_id = v_tenant and status = 'open' and deleted_at is null),
      'in_process', (
        select count(*) from letters l
        where l.tenant_id = v_tenant and l.status = 'open' and l.deleted_at is null
          and not exists (select 1 from letter_flows f where f.letter_id = l.id and f.kind in ('disposition', 'memo') and f.deleted_at is null)
      ),
      'completed', (select count(*) from letters where tenant_id = v_tenant and status = 'closed' and deleted_at is null)
    );
    select coalesce(jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'surat_masuk', coalesce(c.cnt, 0)) order by d), '[]'::jsonb)
    into v_series
    from generate_series(v_start, current_date, interval '1 day') d
    left join (
      select receipt_date, count(*) cnt
      from letters where tenant_id = v_tenant and deleted_at is null and receipt_date >= v_start
      group by receipt_date
    ) c on c.receipt_date = d::date;
  else
    v_mode := 'user';
    v_stats := jsonb_build_object(
      'primary', coalesce((select count(*) from letter_flows f join letters l on l.id = f.letter_id where f.to_position_id = v_pos and f.kind = 'distribution' and l.category = 'primary' and f.deleted_at is null and l.deleted_at is null), 0),
      'invitation', coalesce((select count(*) from letter_flows f join letters l on l.id = f.letter_id where f.to_position_id = v_pos and f.kind = 'distribution' and l.category = 'invitation' and f.deleted_at is null and l.deleted_at is null), 0),
      'disposition', coalesce((select count(*) from letter_flows f where f.to_position_id = v_pos and f.kind = 'disposition' and f.deleted_at is null), 0),
      'memo', coalesce((select count(*) from letter_flows f where f.to_position_id = v_pos and f.kind = 'memo' and f.deleted_at is null), 0)
    );
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(d, 'YYYY-MM-DD'),
      'primary', coalesce(c.primary_cnt, 0),
      'invitation', coalesce(c.inv_cnt, 0),
      'disposition', coalesce(c.disp_cnt, 0),
      'memo', coalesce(c.memo_cnt, 0)
    ) order by d), '[]'::jsonb)
    into v_series
    from generate_series(v_start, current_date, interval '1 day') d
    left join (
      select (f.received_at at time zone 'Asia/Jakarta')::date as day,
        count(*) filter (where f.kind = 'distribution' and l.category = 'primary') as primary_cnt,
        count(*) filter (where f.kind = 'distribution' and l.category = 'invitation') as inv_cnt,
        count(*) filter (where f.kind = 'disposition') as disp_cnt,
        count(*) filter (where f.kind = 'memo') as memo_cnt
      from letter_flows f join letters l on l.id = f.letter_id
      where f.tenant_id = v_tenant and f.to_position_id = v_pos and f.deleted_at is null and l.deleted_at is null
        and (f.received_at at time zone 'Asia/Jakarta')::date >= v_start
      group by 1
    ) c on c.day = d::date;
  end if;

  return jsonb_build_object('mode', v_mode, 'stats', v_stats, 'series', v_series);
end;
$$;

-- ───────────── Fungsi khusus service_role (worker, login, seeding) ─────────────
create or replace function public.claim_notification_jobs(
  p_limit int default 50,
  p_job_ids bigint[] default null
) returns table (
  job_id bigint,
  tenant_id uuid,
  channel text,
  attempts int,
  notification_id uuid,
  title text,
  body text,
  url text,
  item_type text,
  recipient_name text,
  recipient_email text,
  telegram_chat_id text,
  letter_sender text,
  from_position_name text
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select j.id
    from notification_jobs j
    where (
      (j.status = 'pending' and j.run_after <= now())
      or (j.status = 'processing' and j.locked_until is not null and j.locked_until <= now())
    )
      and (p_job_ids is null or j.id = any(p_job_ids))
    order by j.run_after asc
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ),
  claimed as (
    update notification_jobs j
    set status = 'processing',
        attempts = j.attempts + 1,
        locked_until = now() + interval '2 minutes'
    from picked
    where j.id = picked.id
    returning j.*
  )
  select
    c.id as job_id,
    c.tenant_id,
    c.channel,
    c.attempts,
    n.id as notification_id,
    n.title,
    n.body,
    n.url,
    n.item_type,
    p.name as recipient_name,
    p.email as recipient_email,
    p.telegram_chat_id,
    l.sender as letter_sender,
    fp.name as from_position_name
  from claimed c
  join notifications n on n.id = c.notification_id
  join profiles p on p.id = n.user_id
  left join letter_flows f on f.id = n.flow_id
  left join letters l on l.id = f.letter_id
  left join positions fp on fp.id = f.from_position_id;
end;
$$;

create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_hits int;
begin
  insert into rate_limits (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case
      when rate_limits.window_start + make_interval(secs => p_window_seconds) < now() then 1
      else rate_limits.hits + 1
    end,
    window_start = case
      when rate_limits.window_start + make_interval(secs => p_window_seconds) < now() then now()
      else rate_limits.window_start
    end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

create or replace function public.seed_tenant_defaults(p_tenant_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_super_role uuid;
  v_pengelola_role uuid;
  v_pengguna_role uuid;
  v_pimpinan uuid;
  v_sekretaris uuid;
  v_kabag uuid;
begin
  insert into roles (tenant_id, name, is_super)
  values (p_tenant_id, 'Super Admin', true)
  on conflict (tenant_id, name) do update set is_super = true
  returning id into v_super_role;

  insert into roles (tenant_id, name, is_super)
  values (p_tenant_id, 'Pengelola', false)
  on conflict (tenant_id, name) do update set name = excluded.name
  returning id into v_pengelola_role;

  insert into role_permissions (role_id, permission_key, tenant_id)
  select v_pengelola_role, k, p_tenant_id
  from unnest(array[
    'compose.create','compose.store',
    'sent.index','sent.show','sent.edit','sent.update',
    'disposition.index','disposition.show','disposition.create','disposition.store',
    'memo.index','memo.show','memo.create','memo.store','memo.close',
    'master.followup','master.klasifikasi',
    'arsip.index','arsip.show'
  ]) k
  on conflict do nothing;

  insert into roles (tenant_id, name, is_super)
  values (p_tenant_id, 'Pengguna', false)
  on conflict (tenant_id, name) do update set name = excluded.name
  returning id into v_pengguna_role;

  insert into role_permissions (role_id, permission_key, tenant_id)
  select v_pengguna_role, k, p_tenant_id
  from unnest(array[
    'primary.index','primary.show',
    'undangan.index','undangan.show',
    'disposition.index','disposition.show','disposition.create','disposition.store',
    'memo.index','memo.show','memo.create','memo.store'
  ]) k
  on conflict do nothing;

  if not exists (select 1 from positions where tenant_id = p_tenant_id) then
    insert into positions (tenant_id, name) values (p_tenant_id, 'Pimpinan') returning id into v_pimpinan;
    insert into positions (tenant_id, name, parent_id) values (p_tenant_id, 'Sekretaris', v_pimpinan) returning id into v_sekretaris;
    insert into positions (tenant_id, name, parent_id) values (p_tenant_id, 'Kepala Bagian Umum', v_sekretaris) returning id into v_kabag;
    insert into positions (tenant_id, name, parent_id) values (p_tenant_id, 'Kepala Bidang Data dan Informasi', v_sekretaris);
    insert into positions (tenant_id, name, parent_id) values (p_tenant_id, 'Staf Umum', v_kabag);
    insert into positions (tenant_id, name, parent_id) values (p_tenant_id, 'Staf Kearsipan', v_kabag);
  else
    select id into v_pimpinan from positions where tenant_id = p_tenant_id order by created_at asc limit 1;
  end if;

  if not exists (select 1 from followups where tenant_id = p_tenant_id) then
    insert into followups (tenant_id, name) values
      (p_tenant_id, 'Diperiksa dan Diproses Lebih Lanjut'),
      (p_tenant_id, 'Dievaluasi dan Dilaporkan'),
      (p_tenant_id, 'Diteliti/Dikaji'),
      (p_tenant_id, 'Diberikan Saran/Pendapat');
  end if;

  insert into classifications (tenant_id, code, name) values
    (p_tenant_id, '000', 'Umum'),
    (p_tenant_id, '005', 'Undangan'),
    (p_tenant_id, '010', 'Kepegawaian'),
    (p_tenant_id, '020', 'Keuangan'),
    (p_tenant_id, '030', 'Perencanaan dan Program'),
    (p_tenant_id, '040', 'Perlengkapan')
  on conflict (tenant_id, code) do nothing;

  return jsonb_build_object(
    'super_role_id', v_super_role,
    'pengelola_role_id', v_pengelola_role,
    'pengguna_role_id', v_pengguna_role,
    'default_position_id', v_pimpinan
  );
end;
$$;

-- Hak eksekusi RPC
grant execute on function
  public.allowed_disposition_targets(),
  public.create_letter(jsonb, jsonb),
  public.create_flow(text, uuid, uuid[], uuid[], text, text[], jsonb),
  public.close_letter(uuid, uuid, text),
  public.mark_flow_read(uuid),
  public.mark_notification_open(uuid),
  public.mark_all_notifications_read(),
  public.update_letter_meta(uuid, jsonb),
  public.update_letter_recipients(uuid, jsonb),
  public.update_letter_docs(uuid, uuid[], jsonb),
  public.delete_letter(uuid),
  public.inbox_counts(),
  public.dashboard_summary(int)
to authenticated;

revoke execute on function
  public.claim_notification_jobs(int, bigint[]),
  public.check_rate_limit(text, int, int),
  public.seed_tenant_defaults(uuid)
from public, authenticated;

grant execute on function
  public.claim_notification_jobs(int, bigint[]),
  public.check_rate_limit(text, int, int),
  public.seed_tenant_defaults(uuid)
to service_role;
