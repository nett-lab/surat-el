#!/usr/bin/env node
/**
 * Mendaftarkan webhook Bot Telegram ke endpoint /api/telegram/webhook di Vercel.
 * Jalankan: node scripts/set-telegram-webhook.mjs
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');

if (!token || !secret || !appUrl.startsWith('https://')) {
  console.error('Env TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, dan APP_URL (https://) wajib diisi.');
  process.exit(1);
}

const webhookUrl = `${appUrl}/api/telegram/webhook`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
});

const json = await res.json();
if (!res.ok || !json.ok) {
  console.error('Gagal menyetel webhook Telegram:', json);
  process.exit(1);
}

console.log('Webhook Telegram berhasil didaftarkan:', webhookUrl);
