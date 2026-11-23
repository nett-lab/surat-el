'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, hasPermission } from '@/lib/auth/session';
import {
  composeLetterSchema,
  updateLetterMetaSchema,
  updateRecipientsSchema,
  createFlowSchema,
  closeLetterSchema,
} from '@/lib/validation/schemas';
import { mapRpcError } from '@/lib/utils/format';
import { generateRandomToken, isValidPdfBuffer } from '@/lib/utils/security';
import { dispatchNotificationJobs } from '@/lib/notify/dispatcher';

async function verifyUploadedPdfs(tenantId, docs) {
  const admin = createAdminClient();
  for (const doc of docs) {
    if (!doc.path.startsWith(`${tenantId}/`) || !doc.path.endsWith('.pdf')) {
      return 'Jalur berkas lampiran tidak valid.';
    }
    const { data: blob, error } = await admin.storage.from('letter-docs').download(doc.path);
    if (error || !blob) {
      return `Berkas "${doc.name}" tidak ditemukan di penyimpanan.`;
    }
    const slice = Buffer.from(await blob.slice(0, 8).arrayBuffer());
    if (!isValidPdfBuffer(slice)) {
      await admin.storage.from('letter-docs').remove([doc.path]);
      return `Berkas "${doc.name}" bukan dokumen PDF yang valid.`;
    }
  }
  return null;
}

export async function createSignedUploadUrlAction(fileName) {
  const ctx = await requireAuth();
  if (
    !hasPermission(ctx, 'compose.store|sent.update|disposition.store|memo.store')
  ) {
    return { error: 'Anda tidak memiliki izin mengunggah lampiran.' };
  }

  const clean = String(fileName || '').trim();
  if (!clean.toLowerCase().endsWith('.pdf')) {
    return { error: 'Hanya file berformat PDF yang diperbolehkan.' };
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const path = `${ctx.tenant.id}/${yyyy}/${mm}/${generateRandomToken(16)}.pdf`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from('letter-docs')
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { error: 'Gagal membuat tautan unggah dokumen.' };
  }

  return {
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function createLetterAction(payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'compose.store')) {
    return { error: 'Anda tidak memiliki izin membuat surat.' };
  }

  const parsed = composeLetterSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data surat tidak valid.' };
  }

  const pdfErr = await verifyUploadedPdfs(ctx.tenant.id, parsed.data.docs);
  if (pdfErr) return { error: pdfErr };

  const supabase = await createClient();
  const { docs, ...letterData } = parsed.data;
  const { data, error } = await supabase.rpc('create_letter', {
    p_payload: letterData,
    p_docs: docs,
  });

  if (error) {
    return { error: mapRpcError(error, 'Gagal menyimpan surat.') };
  }

  const jobIds = Array.isArray(data?.job_ids) ? data.job_ids : [];
  if (jobIds.length > 0) {
    after(async () => {
      await dispatchNotificationJobs(jobIds);
    });
  }

  revalidatePath('/surat/terkirim');
  revalidatePath('/dashboard');
  return { ok: true, letterId: data.letter_id, agenda: data.agenda };
}

export async function updateLetterMetaAction(letterId, payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'sent.update')) {
    return { error: 'Anda tidak memiliki izin mengubah surat.' };
  }

  const parsed = updateLetterMetaSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data surat tidak valid.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_letter_meta', {
    p_letter_id: letterId,
    p_payload: parsed.data,
  });

  if (error) {
    return { error: mapRpcError(error, 'Gagal memperbarui data surat.') };
  }

  revalidatePath(`/surat/terkirim/${letterId}`);
  revalidatePath('/surat/terkirim');
  return { ok: true };
}

export async function updateLetterRecipientsAction(letterId, recipients) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'sent.update')) {
    return { error: 'Anda tidak memiliki izin mengubah penerima surat.' };
  }

  const parsed = updateRecipientsSchema.safeParse({ recipients });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Data penerima tidak valid.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_letter_recipients', {
    p_letter_id: letterId,
    p_recipients: parsed.data.recipients,
  });

  if (error) {
    return { error: mapRpcError(error, 'Gagal memperbarui penerima surat.') };
  }

  const jobIds = Array.isArray(data?.job_ids) ? data.job_ids : [];
  if (jobIds.length > 0) {
    after(async () => {
      await dispatchNotificationJobs(jobIds);
    });
  }

  revalidatePath(`/surat/terkirim/${letterId}`);
  revalidatePath('/surat/terkirim');
  return { ok: true };
}

export async function updateLetterDocsAction(letterId, removeIds = [], addDocs = []) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'sent.update')) {
    return { error: 'Anda tidak memiliki izin mengubah lampiran.' };
  }

  if (addDocs.length > 0) {
    const pdfErr = await verifyUploadedPdfs(ctx.tenant.id, addDocs);
    if (pdfErr) return { error: pdfErr };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_letter_docs', {
    p_letter_id: letterId,
    p_remove_ids: removeIds,
    p_add_docs: addDocs,
  });

  if (error) {
    return { error: mapRpcError(error, 'Gagal memperbarui lampiran.') };
  }

  const removedPaths = Array.isArray(data?.removed_paths) ? data.removed_paths : [];
  if (removedPaths.length > 0) {
    const admin = createAdminClient();
    await admin.storage.from('letter-docs').remove(removedPaths);
  }

  revalidatePath(`/surat/terkirim/${letterId}`);
  return { ok: true };
}

export async function deleteLetterAction(letterId) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'sent.update')) {
    return { error: 'Anda tidak memiliki izin menghapus surat.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_letter', { p_letter_id: letterId });
  if (error) {
    return { error: mapRpcError(error, 'Gagal menghapus surat.') };
  }

  revalidatePath('/surat/terkirim');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function createFlowAction(payload) {
  const ctx = await requireAuth();
  const parsed = createFlowSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Isian tindak lanjut tidak valid.' };
  }

  const requiredPerm = parsed.data.kind === 'disposition' ? 'disposition.store' : 'memo.store';
  if (!hasPermission(ctx, requiredPerm)) {
    return { error: 'Anda tidak memiliki izin mengirim tindak lanjut ini.' };
  }

  if (parsed.data.docs.length > 0) {
    const pdfErr = await verifyUploadedPdfs(ctx.tenant.id, parsed.data.docs);
    if (pdfErr) return { error: pdfErr };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_flow', {
    p_kind: parsed.data.kind,
    p_root_flow_id: parsed.data.root_flow_id,
    p_to_positions: parsed.data.to_positions,
    p_cc_positions: parsed.data.cc_positions,
    p_instruction: parsed.data.instruction || null,
    p_followups: parsed.data.followups,
    p_docs: parsed.data.docs,
  });

  if (error) {
    return { error: mapRpcError(error, 'Gagal mengirim tindak lanjut.') };
  }

  const jobIds = Array.isArray(data?.job_ids) ? data.job_ids : [];
  if (jobIds.length > 0) {
    after(async () => {
      await dispatchNotificationJobs(jobIds);
    });
  }

  revalidatePath('/disposisi');
  revalidatePath('/nota-dinas');
  revalidatePath('/inbox/utama');
  revalidatePath('/inbox/undangan');
  return { ok: true };
}

export async function closeLetterAction(payload) {
  const ctx = await requireAuth();
  if (!hasPermission(ctx, 'memo.close')) {
    return { error: 'Anda tidak memiliki izin menutup surat.' };
  }

  const parsed = closeLetterSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Isian penutupan surat tidak valid.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('close_letter', {
    p_memo_flow_id: parsed.data.memo_flow_id,
    p_to_position_id: parsed.data.to_position_id,
    p_note: parsed.data.note || null,
  });

  if (error) {
    return { error: mapRpcError(error, 'Gagal menutup surat.') };
  }

  const jobIds = Array.isArray(data?.job_ids) ? data.job_ids : [];
  if (jobIds.length > 0) {
    after(async () => {
      await dispatchNotificationJobs(jobIds);
    });
  }

  revalidatePath('/nota-dinas');
  revalidatePath('/arsip');
  revalidatePath('/surat/terkirim');
  return { ok: true };
}

export async function markFlowReadAction(flowId) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_flow_read', { p_flow_id: flowId });
  if (error) {
    return { error: mapRpcError(error, 'Gagal menandai sudah dibaca.') };
  }
  revalidatePath('/inbox/utama');
  revalidatePath('/inbox/undangan');
  revalidatePath('/disposisi');
  revalidatePath('/nota-dinas');
  revalidatePath('/notifikasi');
  return { ok: true };
}
