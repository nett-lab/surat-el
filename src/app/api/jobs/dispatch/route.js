import { NextResponse } from 'next/server';
import { timingSafeEqualString } from '@/lib/utils/security';
import { dispatchNotificationJobs } from '@/lib/notify/dispatcher';

export async function POST(request) {
  const expected = process.env.CRON_SECRET || '';
  const authHeader = request.headers.get('authorization') || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!expected || !timingSafeEqualString(expected, provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const jobIds = Array.isArray(body?.job_ids) ? body.job_ids : null;
  const result = await dispatchNotificationJobs(jobIds, 50);
  return NextResponse.json({ ok: true, ...result });
}
