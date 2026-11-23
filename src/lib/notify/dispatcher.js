import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage, buildTelegramText } from '@/lib/notify/telegram';
import { sendNotificationEmail } from '@/lib/notify/email';

const MAX_ATTEMPTS = 3;
const BACKOFF_SECONDS = [10, 60, 300];

/**
 * Mengambil batch job dari outbox (`notification_jobs`) dengan `SKIP LOCKED`
 * lalu mengirim melalui Resend (email) atau Telegram Bot API.
 */
export async function dispatchNotificationJobs(jobIds = null, limit = 50) {
  const admin = createAdminClient();
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const { data: jobs, error } = await admin.rpc('claim_notification_jobs', {
    p_limit: limit,
    p_job_ids: Array.isArray(jobIds) && jobIds.length > 0 ? jobIds : null,
  });

  if (error) {
    console.error('[dispatcher] gagal claim jobs:', error.message);
    return { processed: 0, sent: 0, failed: 0, retried: 0 };
  }

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs || []) {
    const openUrl = `${appUrl}/notifikasi/${job.notification_id}/buka`;
    try {
      if (job.channel === 'email') {
        if (!job.recipient_email) throw new Error('Alamat email penerima kosong.');
        await sendNotificationEmail(job, openUrl);
      } else if (job.channel === 'telegram') {
        if (!job.telegram_chat_id) throw new Error('Telegram chat_id penerima kosong.');
        await sendTelegramMessage(job.telegram_chat_id, buildTelegramText(job, openUrl));
      } else {
        throw new Error(`Kanal tidak dikenal: ${job.channel}`);
      }

      await admin
        .from('notification_jobs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          locked_until: null,
          last_error: null,
        })
        .eq('id', job.job_id);
      sent += 1;
    } catch (err) {
      const msg = (err?.message || 'Unknown error').slice(0, 500);
      const isFinal = job.attempts >= MAX_ATTEMPTS;
      const delaySec = BACKOFF_SECONDS[Math.min(job.attempts - 1, BACKOFF_SECONDS.length - 1)];
      const nextRun = new Date(Date.now() + delaySec * 1000).toISOString();

      await admin
        .from('notification_jobs')
        .update({
          status: isFinal ? 'failed' : 'pending',
          run_after: isFinal ? new Date().toISOString() : nextRun,
          locked_until: null,
          last_error: msg,
        })
        .eq('id', job.job_id);

      if (isFinal) failed += 1;
      else retried += 1;
    }
  }

  return { processed: (jobs || []).length, sent, failed, retried };
}
