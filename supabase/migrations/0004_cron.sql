-- Penjadwalan pg_cron + pg_net untuk Vercel Hobby (sweeper antrean tiap menit & bersih-bersih).
-- Catatan: sebelum menjalankan di produksi, simpan secret berikut di Supabase Vault:
--   select vault.create_secret('https://your-app.vercel.app', 'esurat_app_url');
--   select vault.create_secret('<CRON_SECRET yang sama dengan env Vercel>', 'esurat_cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function app.trigger_notification_dispatcher() returns void
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  v_url text;
  v_secret text;
begin
  -- Jangan lakukan panggilan HTTP jika tidak ada job yang jatuh tempo.
  if not exists (
    select 1 from notification_jobs
    where (status = 'pending' and run_after <= now())
       or (status = 'processing' and locked_until <= now())
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'esurat_app_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'esurat_cron_secret' limit 1;

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{"source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

-- Bersihkan token Telegram kedaluwarsa & rate limit lama setiap hari pukul 03:00 UTC.
create or replace function app.cleanup_ephemeral_records() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from telegram_link_tokens where expires_at < now() - interval '1 day';
  delete from rate_limits where window_start < now() - interval '1 day';
end;
$$;

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'esurat-dispatch-notifications') then
    perform cron.unschedule('esurat-dispatch-notifications');
  end if;
  perform cron.schedule(
    'esurat-dispatch-notifications',
    '* * * * *',
    'select app.trigger_notification_dispatcher();'
  );

  if exists (select 1 from cron.job where jobname = 'esurat-cleanup-daily') then
    perform cron.unschedule('esurat-cleanup-daily');
  end if;
  perform cron.schedule(
    'esurat-cleanup-daily',
    '0 3 * * *',
    'select app.cleanup_ephemeral_records();'
  );
end $cron$;
