#!/usr/bin/env node
/**
 * Skrip Migrasi Data e-Surat v2 (Laravel) → e-Surat v3 (Supabase Multi-Tenant)
 *
 * Cara pakai:
 *   node scripts/migrate-v2.mjs \
 *     --input ./export-v2.json \
 *     --slug instansi-anda \
 *     --name "Nama Instansi" \
 *     [--storage-dir ./storage/app/private] \
 *     [--dry-run]
 *
 * Format JSON input dapat diekspor dari database v2 (lihat README bagian Migrasi v2).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token.startsWith('--')) {
      args[token.slice(2)] = argv[++i];
    }
  }
  return args;
}

function randomPassword() {
  return `Tmp#${crypto.randomBytes(9).toString('base64url')}9a`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.slug || !args.name) {
    console.error('Penggunaan: node scripts/migrate-v2.mjs --input <file.json> --slug <slug> --name "<Nama>" [--storage-dir <dir>] [--dry-run]');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const summary = {
    positions: (raw.positions || []).length,
    classifications: (raw.ref_kode_klasifikasi_arsip || []).length,
    followups: (raw.followups || []).length,
    users: (raw.users || []).length,
    letters: (raw.letters || []).length,
    recipients: (raw.letter_recipients || []).length,
    dispositions: (raw.dispositions || []).length,
    memos: (raw.memos || []).length,
    docs: (raw.letter_docs || []).length,
    activities: (raw.letter_activities || []).length,
  };

  console.log('Ringkasan sumber v2:', summary);
  if (args.dryRun) {
    console.log('[DRY RUN] Validasi struktur selesai. Tidak ada data yang ditulis.');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Env NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Buat tenant
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .insert({ slug: args.slug, name: args.name, status: 'active' })
    .select('id')
    .single();
  if (tErr) throw tErr;
  const tenantId = tenant.id;
  await admin.rpc('seed_tenant_defaults', { p_tenant_id: tenantId });

  // 2. Positions (2-pass agar parent_id terpetakan)
  const posMap = new Map();
  await admin.from('positions').delete().eq('tenant_id', tenantId);
  for (const p of raw.positions || []) {
    const { data, error } = await admin
      .from('positions')
      .insert({ tenant_id: tenantId, name: p.name, is_active: Boolean(p.is_active ?? true) })
      .select('id')
      .single();
    if (error) throw error;
    posMap.set(p.id, data.id);
  }
  for (const p of raw.positions || []) {
    if (p.parent_id && posMap.has(p.parent_id)) {
      await admin
        .from('positions')
        .update({ parent_id: posMap.get(p.parent_id) })
        .eq('id', posMap.get(p.id));
    }
  }

  // 3. Classifications & Agenda Counters
  const classMap = new Map();
  for (const c of raw.ref_kode_klasifikasi_arsip || []) {
    const { data, error } = await admin
      .from('classifications')
      .upsert(
        { tenant_id: tenantId, code: String(c.kode), name: c.nama, is_active: Boolean(c.is_active ?? true) },
        { onConflict: 'tenant_id,code' }
      )
      .select('id')
      .single();
    if (error) throw error;
    classMap.set(c.id, data.id);
  }

  const maxCounter = new Map();
  for (const a of raw.ref_agenda_surat || []) {
    const cid = classMap.get(a.klasifikasi_id);
    if (!cid) continue;
    const key = `${cid}:${a.tahun}`;
    const cur = maxCounter.get(key) || 0;
    if (Number(a.nomor_urut) > cur) maxCounter.set(key, Number(a.nomor_urut));
  }
  for (const [key, lastNo] of maxCounter.entries()) {
    const [cid, year] = key.split(':');
    await admin.from('agenda_counters').upsert({
      tenant_id: tenantId,
      classification_id: cid,
      year: Number(year),
      last_no: lastNo,
    });
  }

  // 4. Followups
  await admin.from('followups').delete().eq('tenant_id', tenantId);
  for (const f of raw.followups || []) {
    await admin.from('followups').insert({
      tenant_id: tenantId,
      name: f.name,
      is_active: Boolean(f.is_active ?? true),
    });
  }

  // 5. Roles
  const { data: existingRoles } = await admin.from('roles').select('id, name').eq('tenant_id', tenantId);
  const roleByName = new Map((existingRoles || []).map((r) => [r.name, r.id]));
  const roleMap = new Map();
  for (const r of raw.roles || []) {
    if (roleByName.has(r.name)) {
      roleMap.set(r.id, roleByName.get(r.name));
    } else {
      const { data } = await admin
        .from('roles')
        .insert({ tenant_id: tenantId, name: r.name, is_super: r.name === 'Super Admin' })
        .select('id')
        .single();
      roleMap.set(r.id, data.id);
    }
  }

  // 6. Users → Supabase Auth + profiles (wajib ganti password pada login pertama)
  const userMap = new Map();
  const credentials = [];
  const internalDomain = process.env.INTERNAL_EMAIL_DOMAIN || 'users.esurat.invalid';

  for (const u of raw.users || []) {
    const tempPassword = randomPassword();
    const authEmail = u.email || `${u.username}.${args.slug}@${internalDomain}`;
    const { data: authCreated, error: authErr } = await admin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: u.name },
    });
    if (authErr) {
      console.warn(`Lewati user ${u.username}: ${authErr.message}`);
      continue;
    }
    const uid = authCreated.user.id;
    userMap.set(u.id, uid);
    credentials.push({ username: u.username, email: u.email || '-', tempPassword });

    await admin.from('profiles').insert({
      id: uid,
      tenant_id: tenantId,
      username: String(u.username).toLowerCase(),
      name: u.name,
      email: u.email || null,
      is_active: Boolean(u.is_active ?? true),
      must_change_password: true,
      telegram_chat_id: u.telegram_chat_id || null,
    });
  }

  for (const mp of raw.model_has_position || []) {
    const uid = userMap.get(mp.model_id);
    const pid = posMap.get(mp.position_id);
    if (!uid || !pid) continue;
    await admin.from('position_assignments').insert({
      tenant_id: tenantId,
      user_id: uid,
      position_id: pid,
      start_date: mp.start_date || new Date().toISOString().slice(0, 10),
      end_date: mp.end_date || null,
      is_active: Boolean(mp.is_active),
    });
  }

  for (const mr of raw.model_has_roles || []) {
    const uid = userMap.get(mr.model_id);
    const rid = roleMap.get(mr.role_id);
    if (!uid || !rid) continue;
    await admin.from('user_roles').upsert({ tenant_id: tenantId, user_id: uid, role_id: rid });
  }

  for (const sp of raw.model_has_special_dispositions || []) {
    const uid = userMap.get(sp.model_id);
    const pid = posMap.get(sp.to_position_id);
    if (!uid || !pid) continue;
    await admin.from('special_disposition_grants').upsert({
      tenant_id: tenantId,
      user_id: uid,
      to_position_id: pid,
      is_active: Boolean(sp.is_active),
      granted_at: sp.granted_at || new Date().toISOString(),
      revoked_at: sp.revoked_at || null,
    });
  }

  // 7. Letters
  const letterMap = new Map();
  for (const l of raw.letters || []) {
    const creator = userMap.get(l.created_by) || Array.from(userMap.values())[0];
    if (!creator) continue;
    const { data, error } = await admin
      .from('letters')
      .insert({
        tenant_id: tenantId,
        sender: l.sender,
        number: l.number || null,
        letter_date: l.date,
        receipt_date: l.receipt_date,
        subject: l.subject,
        category: String(l.category) === '2' ? 'invitation' : 'primary',
        security_class: ['SR', 'R', 'T', 'B'].includes(l.security_classification) ? l.security_classification : 'B',
        received_via: ['email', 'physical', 'internal', 'other'].includes(l.received_via) ? l.received_via : 'other',
        agenda: l.agenda,
        status: l.status === 'close' ? 'closed' : 'open',
        created_by: creator,
        created_at: l.created_at || new Date().toISOString(),
        deleted_at: l.deleted_at || null,
      })
      .select('id')
      .single();
    if (error) {
      console.warn(`Lewati surat ${l.agenda}: ${error.message}`);
      continue;
    }
    letterMap.set(l.id, data.id);
  }

  // 8. Recipients → letter_flows (distribution)
  const recipientMap = new Map();
  for (const r of raw.letter_recipients || []) {
    const lid = letterMap.get(r.letter_id);
    const uid = userMap.get(r.from_user_id);
    const fromP = posMap.get(r.from_position_id);
    const toP = posMap.get(r.to_position_id);
    if (!lid || !uid || !fromP || !toP) continue;
    const flowId = crypto.randomUUID();
    await admin.from('letter_flows').insert({
      id: flowId,
      tenant_id: tenantId,
      letter_id: lid,
      kind: 'distribution',
      root_flow_id: flowId,
      from_user_id: uid,
      from_position_id: fromP,
      to_position_id: toP,
      instruction: r.instruction || null,
      received_at: r.received_at || r.created_at || new Date().toISOString(),
      read_at: r.read_at || null,
      deleted_at: r.deleted_at || null,
    });
    recipientMap.set(r.id, flowId);
  }

  // 9. Dispositions & Memos → letter_flows
  for (const d of raw.dispositions || []) {
    const lid = letterMap.get(d.letter_id);
    const rootId = recipientMap.get(d.letter_recipient_id);
    const uid = userMap.get(d.from_user_id);
    const fromP = posMap.get(d.from_position_id);
    const toP = posMap.get(d.to_position_id);
    if (!lid || !rootId || !uid || !fromP || !toP) continue;
    await admin.from('letter_flows').insert({
      tenant_id: tenantId,
      letter_id: lid,
      kind: 'disposition',
      root_flow_id: rootId,
      from_user_id: uid,
      from_position_id: fromP,
      to_position_id: toP,
      is_cc: Boolean(d.is_cc),
      instruction: d.instruction || null,
      followups: d.followup ? String(d.followup).split(';').map((s) => s.trim()).filter(Boolean) : [],
      received_at: d.received_at || d.created_at || new Date().toISOString(),
      read_at: d.read_at || null,
      deleted_at: d.deleted_at || null,
    });
  }

  for (const m of raw.memos || []) {
    const lid = letterMap.get(m.letter_id);
    const rootId = recipientMap.get(m.letter_recipient_id);
    const uid = userMap.get(m.from_user_id);
    const fromP = posMap.get(m.from_position_id);
    const toP = posMap.get(m.to_position_id);
    if (!lid || !rootId || !uid || !fromP || !toP) continue;
    await admin.from('letter_flows').insert({
      tenant_id: tenantId,
      letter_id: lid,
      kind: 'memo',
      root_flow_id: rootId,
      from_user_id: uid,
      from_position_id: fromP,
      to_position_id: toP,
      is_cc: Boolean(m.is_cc),
      instruction: m.instruction || null,
      received_at: m.received_at || m.created_at || new Date().toISOString(),
      read_at: m.read_at || null,
      deleted_at: m.deleted_at || null,
    });
  }

  // 10. Lampiran PDF (opsional jika --storage-dir diberikan)
  for (const doc of raw.letter_docs || []) {
    const lid = letterMap.get(doc.letter_id);
    if (!lid || !doc.path) continue;
    const destPath = `${tenantId}/migrated/${crypto.randomUUID()}.pdf`;

    if (args['storage-dir']) {
      const localFile = path.join(args['storage-dir'], doc.path);
      if (fs.existsSync(localFile)) {
        const bytes = fs.readFileSync(localFile);
        await admin.storage
          .from('letter-docs')
          .upload(destPath, bytes, { contentType: 'application/pdf' });
      }
    }

    await admin.from('letter_docs').insert({
      tenant_id: tenantId,
      letter_id: lid,
      name: doc.name || 'lampiran.pdf',
      path: destPath,
      is_active: Boolean(doc.is_active ?? true),
      deleted_at: doc.deleted_at || null,
    });
  }

  // 11. Jejak audit
  for (const a of raw.letter_activities || []) {
    const lid = letterMap.get(a.letter_id);
    const uid = userMap.get(a.user_id);
    if (!lid || !uid) continue;
    await admin.from('letter_activities').insert({
      tenant_id: tenantId,
      letter_id: lid,
      user_id: uid,
      action: a.action,
      description: a.description,
      changes: a.changes || null,
      created_at: a.created_at || new Date().toISOString(),
    });
  }

  const credFile = `migrated-credentials-${args.slug}.json`;
  fs.writeFileSync(credFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  console.log(`Migrasi selesai untuk tenant "${args.slug}" (${tenantId}).`);
  console.log(`Kredensial sementara disimpan di ${credFile} — bagikan aman lalu hapus berkas tersebut.`);
}

main().catch((err) => {
  console.error('Migrasi gagal:', err);
  process.exit(1);
});
