export async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN belum dikonfigurasi.');
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(chatId),
      text: String(text).slice(0, 3500),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

export function buildTelegramText(job, openUrl) {
  const lines = [job.title, `Perihal: ${job.body || '(tanpa perihal)'}`];
  const sender = job.item_type === 'primary' || job.item_type === 'invitation'
    ? job.letter_sender
    : job.from_position_name;
  if (sender) {
    lines.push(`Pengirim: ${sender}`);
  }
  lines.push(openUrl);
  lines.push('Pesan otomatis sistem e-Surat.');
  return lines.join('\n');
}
