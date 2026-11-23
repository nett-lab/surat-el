import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { timingSafeEqualString, sha256Hex } from '@/lib/utils/security';
import { sendTelegramMessage } from '@/lib/notify/telegram';

export async function POST(request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const provided = request.headers.get('x-telegram-bot-api-secret-token') || '';

  if (!expected || !timingSafeEqualString(expected, provided)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let update = null;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatIdRaw = update?.message?.chat?.id;
  const text = String(update?.message?.text || '').trim();
  const match = text.match(/^\/start(?:@\w+)?\s+(\S+)$/u);

  if (chatIdRaw === undefined || chatIdRaw === null || !match) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(chatIdRaw);
  const tokenHash = sha256Hex(match[1]);
  const admin = createAdminClient();

  let status = 'invalid';

  const { data: token } = await admin
    .from('telegram_link_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (token && !token.used_at && new Date(token.expires_at).getTime() > Date.now()) {
    const { data: owner } = await admin
      .from('profiles')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (owner && owner.id !== token.user_id) {
      status = 'taken';
    } else {
      const { error: uErr } = await admin
        .from('profiles')
        .update({ telegram_chat_id: chatId })
        .eq('id', token.user_id);

      if (!uErr) {
        await admin
          .from('telegram_link_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', token.id);
        status = 'linked';
      }
    }
  }

  const reply =
    status === 'linked'
      ? 'Akun Telegram Anda berhasil terhubung ke e-Surat. Notifikasi surat masuk, disposisi, dan nota dinas (klasifikasi Biasa) akan dikirim ke chat ini.'
      : status === 'taken'
      ? 'Chat Telegram ini sudah terhubung dengan akun e-Surat lain. Putuskan tautan pada akun tersebut terlebih dahulu.'
      : 'Tautan Telegram tidak valid, sudah dipakai, atau kedaluwarsa. Buat tautan baru dari halaman Pengaturan Profil.';

  try {
    await sendTelegramMessage(chatId, reply);
  } catch (err) {
    console.warn('[telegram-webhook] gagal mengirim balasan:', err?.message);
  }

  return NextResponse.json({ ok: true });
}
