import { Resend } from 'resend';

let resendClient;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY belum dikonfigurasi.');
  }
  if (!resendClient) {
    resendClient = new Resend(key);
  }
  return resendClient;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendNotificationEmail(job, openUrl) {
  const from = process.env.MAIL_FROM;
  if (!from) {
    throw new Error('MAIL_FROM belum dikonfigurasi.');
  }

  const sender = job.item_type === 'primary' || job.item_type === 'invitation'
    ? job.letter_sender
    : job.from_position_name;

  const subject = `${job.title}: ${job.body || '(tanpa perihal)'}`.slice(0, 180);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 18px;">${escapeHtml(job.title)}</h2>
      <p style="margin: 0 0 12px;">Halo ${escapeHtml(job.recipient_name || 'Bapak/Ibu')},</p>
      <p style="margin: 0 0 12px;">${escapeHtml(job.title)} baru telah masuk ke inbox jabatan Anda.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 10px 12px; font-weight: 600; width: 110px; vertical-align: top;">Perihal</td>
          <td style="padding: 10px 12px;">${escapeHtml(job.body)}</td>
        </tr>
        ${
          sender
            ? `<tr>
                <td style="padding: 10px 12px; font-weight: 600; vertical-align: top; border-top: 1px solid #e2e8f0;">Pengirim</td>
                <td style="padding: 10px 12px; border-top: 1px solid #e2e8f0;">${escapeHtml(sender)}</td>
              </tr>`
            : ''
        }
      </table>
      <p style="margin: 20px 0;">
        <a href="${escapeHtml(openUrl)}" style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600;">
          Buka di e-Surat
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        Email ini dikirim otomatis oleh sistem e-Surat. Jangan membalas email ini.
      </p>
    </div>
  `;

  const { error } = await getResend().emails.send({
    from,
    to: job.recipient_email,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }
}

export async function sendTenantWelcomeEmail({ to, orgName, slug, username, tempPassword, appUrl }) {
  const from = process.env.MAIL_FROM;
  if (!from || !process.env.RESEND_API_KEY) return;

  const loginUrl = `${appUrl.replace(/\/$/, '')}/login?instansi=${encodeURIComponent(slug)}`;
  await getResend().emails.send({
    from,
    to,
    subject: `Akun Instansi ${orgName} di e-Surat Telah Aktif`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Instansi Anda Siap Digunakan</h2>
        <p>Permohonan pendaftaran <strong>${escapeHtml(orgName)}</strong> telah disetujui.</p>
        <p>Gunakan detail berikut untuk masuk pertama kali (Anda akan diminta mengganti kata sandi):</p>
        <ul>
          <li><strong>Kode Instansi:</strong> ${escapeHtml(slug)}</li>
          <li><strong>Username:</strong> ${escapeHtml(username)}</li>
          <li><strong>Kata Sandi Sementara:</strong> <code>${escapeHtml(tempPassword)}</code></li>
        </ul>
        <p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Masuk ke e-Surat</a></p>
      </div>
    `,
  });
}
