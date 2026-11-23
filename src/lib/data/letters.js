import { createClient } from '@/lib/supabase/server';

const PER_PAGE = 15;

export async function listInboxFlows({ positionId, kind, category = null, search = '', filter = 'all', page = 1 }) {
  if (!positionId) return { items: [], total: 0, page: 1 };
  const supabase = await createClient();
  const safePage = Math.max(1, Number(page) || 1);
  const from = (safePage - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  let query = supabase
    .from('letter_flows')
    .select(
      `id, kind, root_flow_id, is_cc, is_closing, instruction, followups, received_at, read_at,
       from_position:positions!letter_flows_from_position_id_fkey (id, name),
       letter:letters!inner (id, agenda, sender, number, subject, category, security_class, received_via, status, receipt_date)`,
      { count: 'exact' }
    )
    .eq('to_position_id', positionId)
    .eq('kind', kind)
    .is('deleted_at', null)
    .is('letter.deleted_at', null);

  if (category) {
    query = query.eq('letter.category', category);
  }
  if (filter === 'read') {
    query = query.not('read_at', 'is', null);
  } else if (filter === 'unread') {
    query = query.is('read_at', null);
  }
  if (search) {
    const q = search.replaceAll('%', '').replaceAll(',', ' ');
    query = query.or(
      `agenda.ilike.%${q}%,sender.ilike.%${q}%,subject.ilike.%${q}%,number.ilike.%${q}%`,
      { referencedTable: 'letter' }
    );
  }

  const { data, count } = await query
    .order('received_at', { ascending: false })
    .range(from, to);

  return {
    items: data || [],
    total: count || 0,
    page: safePage,
  };
}

export async function getFlowDetail(flowId, { positionId, expectedKind, expectedCategory = null }) {
  const supabase = await createClient();

  const { data: flow } = await supabase
    .from('letter_flows')
    .select(
      `id, letter_id, kind, root_flow_id, is_cc, is_closing, instruction, followups,
       from_position_id, to_position_id, received_at, read_at,
       from_user:profiles!letter_flows_from_user_id_fkey (id, name),
       from_position:positions!letter_flows_from_position_id_fkey (id, name),
       to_position:positions!letter_flows_to_position_id_fkey (id, name)`
    )
    .eq('id', flowId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!flow || flow.kind !== expectedKind || flow.to_position_id !== positionId) {
    return null;
  }

  const detail = await getLetterFullDetail(flow.letter_id);
  if (!detail) return null;
  if (expectedCategory && detail.letter.category !== expectedCategory) {
    return null;
  }

  // Otomatis tandai dibaca + sinkronkan notifikasi saat dibuka oleh pemilik.
  if (!flow.read_at) {
    await supabase.rpc('mark_flow_read', { p_flow_id: flow.id });
    flow.read_at = new Date().toISOString();
  }

  return { flow, ...detail };
}

export async function listLetters({ status = null, search = '', page = 1 }) {
  const supabase = await createClient();
  const safePage = Math.max(1, Number(page) || 1);
  const from = (safePage - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  let query = supabase
    .from('letters')
    .select('id, agenda, sender, number, subject, category, security_class, received_via, status, receipt_date, created_at', {
      count: 'exact',
    })
    .is('deleted_at', null);

  if (status) {
    query = query.eq('status', status);
  }
  if (search) {
    const q = search.replaceAll('%', '').replaceAll(',', ' ');
    query = query.or(`agenda.ilike.%${q}%,sender.ilike.%${q}%,subject.ilike.%${q}%,number.ilike.%${q}%`);
  }

  const { data, count } = await query
    .order(status === 'closed' ? 'receipt_date' : 'created_at', { ascending: false })
    .range(from, to);

  return {
    items: data || [],
    total: count || 0,
    page: safePage,
  };
}

export async function getLetterFullDetail(letterId, { requireClosed = false } = {}) {
  const supabase = await createClient();

  let letterQuery = supabase
    .from('letters')
    .select(
      `id, agenda, sender, number, letter_date, receipt_date, subject,
       category, security_class, received_via, status, created_at,
       creator:profiles!letters_created_by_fkey (id, name)`
    )
    .eq('id', letterId)
    .is('deleted_at', null);

  if (requireClosed) {
    letterQuery = letterQuery.eq('status', 'closed');
  }

  const { data: letter } = await letterQuery.maybeSingle();
  if (!letter) return null;

  const [{ data: flows }, { data: docs }, { data: activities }] = await Promise.all([
    supabase
      .from('letter_flows')
      .select(
        `id, kind, root_flow_id, is_cc, is_closing, instruction, followups,
         from_position_id, to_position_id, received_at, read_at,
         from_position:positions!letter_flows_from_position_id_fkey (id, name),
         to_position:positions!letter_flows_to_position_id_fkey (id, name)`
      )
      .eq('letter_id', letter.id)
      .is('deleted_at', null)
      .order('received_at', { ascending: true }),
    supabase
      .from('letter_docs')
      .select('id, name, created_at')
      .eq('letter_id', letter.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('letter_activities')
      .select('id, action, description, changes, created_at, user:profiles!letter_activities_user_id_fkey (id, name)')
      .eq('letter_id', letter.id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    letter,
    flows: flows || [],
    docs: docs || [],
    activities: activities || [],
  };
}
