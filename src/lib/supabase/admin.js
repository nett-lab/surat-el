import { createClient } from '@supabase/supabase-js';

let adminClient;

/**
 * Service-role client — hanya boleh dipakai di server (Server Actions, Route Handlers, scripts).
 * Jangan pernah mengimpor file ini di Client Component.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client tidak boleh dipanggil di sisi browser.');
  }
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Konfigurasi SUPABASE_SERVICE_ROLE_KEY belum lengkap.');
    }
    adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}
