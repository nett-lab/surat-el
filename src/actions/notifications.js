'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, hasPermission } from '@/lib/auth/session';
import { generateRandomToken, sha256Hex } from '@/lib/utils/security';
import { dispatchNotificationJobs } from '@/lib/notify/dispatcher';

export async function markAllNotificationsReadAction() {
  await requireAuth();
  const supabase = await createClient();
  await supabase.rpc('mark_all_notifications_read');
  revalidatePath('/notifikasi');
  return { ok: true };
}

export async function deleteNotificationAction(id) {
  await requireAuth();
  const supabase = await createClient();
  await supabase.from('notifications').delete().eq('id', id);
  revalidatePath('/notifikasi');
  return { ok: true };
}

export async function deleteAllNotificationsAction() {
  const ctx = await requireAuth();
  const supabase = await createClient();
  await supabase.from('notifications').delete().eq('user_id', ctx.user.id);
  revalidatePath('/notifikasi');
  return { ok: true };
}

export async function retryNotificationJobAction(jobId) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'master.pengguna')) {
    return { error: 'Tidak memiliki izin.' };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('notification_jobs')
    .update({
      status: 'pending',
      attempts: 0,
      run_after: new Date().toISOString(),
      locked_until: null,
      last_error: null,
    })
    .eq('id', jobId)
    .eq('tenant_id', ctx.tenant.id)
    .select('id')
    .maybeSingle();

  if (error || !updated) {
    return { error: 'Job tidak ditemukan.' };
  }

  after(async () => {
    await dispatchNotificationJobs([updated.id]);
  });

  revalidatePath('/admin/pengiriman');
  return { ok: true };
}

export async function createTelegramLinkAction() {
  const ctx = await requireAuth();
  if (!ctx.tenant?.features?.telegram) {
    return { error: 'Notifikasi Telegram belum diaktifkan untuk instansi Anda.' };
  }

  const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
  if (!botUsername || !process.env.TELEGRAM_BOT_TOKEN) {
    return { error: 'Bot Telegram belum dikonfigurasi pada server.' };
  }

  const admin = createAdminClient();
  const { data: allowed } = await admin.rpc('check_rate_limit', {
    p_key: `tg-link:${ctx.user.id}`,
    p_max: 10,
    p_window_seconds: 300,
  });
  if (allowed === false) {
    return { error: 'Terlalu sering membuat tautan. Coba lagi beberapa menit lagi.' };
  }

  await admin
    .from('telegram_link_tokens')
    .delete()
    .eq('user_id', ctx.user.id)
    .is('used_at', null);

  const rawToken = generateRandomToken(32);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await admin.from('telegram_link_tokens').insert({
    user_id: ctx.user.id,
    token_hash: sha256Hex(rawToken),
    expires_at: expiresAt,
  });

  const url = `https://t.me/${botUsername}?start=${rawToken}`;
  const svg = await QRCode.toString(url, { type: 'svg', width: 220, margin: 1 });

  return { ok: true, url, svg, expiresAt };
}

export async function unlinkTelegramAction() {
  const ctx = await requireAuth();
  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('id', ctx.user.id);
  revalidatePath('/pengaturan/profil');
  return { ok: true };
}
