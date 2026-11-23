'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, Button } from '@/components/ui/primitives';

export function DashboardView({ initial }) {
  const [data, setData] = useState(initial);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  async function changeDays(nextDays) {
    setDays(nextDays);
    setLoading(true);
    const supabase = createClient();
    const { data: res } = await supabase.rpc('dashboard_summary', { p_days: nextDays });
    if (res) setData(res);
    setLoading(false);
  }

  const statCards =
    data.mode === 'admin'
      ? [
          { label: 'Pengguna Aktif', value: data.stats?.active_users ?? 0 },
          { label: 'Jabatan Aktif', value: data.stats?.active_positions ?? 0 },
          { label: 'Total Surat', value: data.stats?.total_letters ?? 0 },
          { label: 'Surat Terbuka', value: data.stats?.open_letters ?? 0 },
        ]
      : data.mode === 'manager'
      ? [
          { label: 'Total Surat Masuk', value: data.stats?.total_incoming ?? 0 },
          { label: 'Masih Terbuka', value: data.stats?.open_letters ?? 0 },
          { label: 'Menunggu Tindak Lanjut', value: data.stats?.in_process ?? 0 },
          { label: 'Selesai (Arsip)', value: data.stats?.completed ?? 0 },
        ]
      : [
          { label: 'Surat Utama', value: data.stats?.primary ?? 0 },
          { label: 'Undangan', value: data.stats?.invitation ?? 0 },
          { label: 'Disposisi', value: data.stats?.disposition ?? 0 },
          { label: 'Nota Dinas', value: data.stats?.memo ?? 0 },
        ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-[var(--fg-muted)]">{s.label}</p>
              <p className="mt-2 text-2xl font-bold text-[var(--fg)]">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--fg)]">
              {data.mode === 'user' ? 'Tren Aktivitas Kotak Masuk Anda' : 'Tren Surat Masuk Instansi'}
            </h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Ringkasan harian dalam {days} hari terakhir
            </p>
          </div>
          <div className="flex gap-1.5">
            {[7, 30, 90].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? 'primary' : 'outline'}
                disabled={loading}
                onClick={() => changeDays(d)}
              >
                {d} Hari
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--fg-muted)' }}
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                {data.mode === 'user' ? (
                  <>
                    <Area type="monotone" dataKey="primary" name="Utama" stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.18} />
                    <Area type="monotone" dataKey="invitation" name="Undangan" stroke="#0891b2" fill="#0891b2" fillOpacity={0.14} />
                    <Area type="monotone" dataKey="disposition" name="Disposisi" stroke="#d97706" fill="#d97706" fillOpacity={0.14} />
                    <Area type="monotone" dataKey="memo" name="Nota Dinas" stroke="#059669" fill="#059669" fillOpacity={0.14} />
                  </>
                ) : (
                  <Area type="monotone" dataKey="surat_masuk" name="Surat Masuk" stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.2} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
