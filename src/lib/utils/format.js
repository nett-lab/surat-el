const TZ = 'Asia/Jakarta';

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(d);
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(d);
}

export const SECURITY_CLASSES = {
  SR: { label: 'Sangat Rahasia', short: 'SR', restricted: true, className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900' },
  R: { label: 'Rahasia', short: 'R', restricted: true, className: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900' },
  T: { label: 'Terbatas', short: 'T', restricted: true, className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900' },
  B: { label: 'Biasa', short: 'B', restricted: false, className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
};

export const CATEGORY_LABELS = {
  primary: 'Surat Utama',
  invitation: 'Undangan',
};

export const RECEIVED_VIA_LABELS = {
  email: 'Email',
  physical: 'Fisik / Pos',
  internal: 'Internal',
  other: 'Lainnya',
};

export const FLOW_KIND_LABELS = {
  distribution: 'Distribusi Awal',
  disposition: 'Disposisi',
  memo: 'Nota Dinas',
};

const RPC_ERROR_MESSAGES = {
  FORBIDDEN: 'Anda tidak memiliki izin untuk melakukan tindakan ini.',
  NO_ACTIVE_POSITION: 'Anda belum memiliki jabatan aktif. Hubungi admin instansi.',
  INVALID_AGENDA_YEAR: 'Tahun agenda tidak valid.',
  INVALID_CLASSIFICATION: 'Kode klasifikasi arsip tidak ditemukan atau tidak aktif.',
  RECIPIENTS_REQUIRED: 'Minimal satu jabatan penerima wajib dipilih.',
  INVALID_RECIPIENT_POSITION: 'Jabatan penerima tidak ditemukan atau tidak aktif.',
  DOCS_REQUIRED: 'Minimal satu lampiran PDF wajib diunggah.',
  INVALID_DOC_PATH: 'Jalur berkas lampiran tidak valid.',
  INVALID_FLOW_KIND: 'Jenis tindak lanjut tidak dikenal.',
  FOLLOWUP_NOT_AUTHORIZED: 'Anda tidak berwenang menindaklanjuti surat ini.',
  ROOT_FLOW_NOT_FOUND: 'Data distribusi awal surat tidak ditemukan.',
  LETTER_CLOSED_OR_NOT_FOUND: 'Surat sudah ditutup atau tidak ditemukan.',
  DISPOSITION_TARGET_NOT_ALLOWED: 'Salah satu jabatan tujuan berada di luar wewenang disposisi Anda.',
  INVALID_TARGET_POSITION: 'Jabatan tujuan tidak valid atau tidak aktif.',
  MEMO_NOT_OWNED: 'Anda hanya dapat menutup surat melalui nota dinas yang ditujukan langsung ke jabatan Anda.',
  LETTER_ALREADY_CLOSED: 'Surat ini sudah berstatus ditutup.',
  FLOW_NOT_OWNED: 'Item ini tidak ditujukan ke jabatan aktif Anda.',
  NOTIFICATION_NOT_FOUND: 'Notifikasi tidak ditemukan.',
  LETTER_NOT_EDITABLE: 'Surat sudah ditutup atau tidak ditemukan sehingga tidak dapat diubah.',
  LETTER_HAS_FOLLOWUPS: 'Penerima tidak dapat diubah karena sudah ada disposisi atau nota dinas.',
  LETTER_NOT_FOUND: 'Surat tidak ditemukan.',
  POSITION_PARENT_INVALID: 'Jabatan induk tidak valid.',
  POSITION_CYCLE_DETECTED: 'Hierarki jabatan tidak boleh membentuk siklus.',
};

/**
 * Memetakan error database/RPC menjadi pesan ramah pengguna agar detail SQL tidak bocor.
 */
export function mapRpcError(error, fallback = 'Terjadi kesalahan saat memproses permintaan.') {
  const raw = error?.message || '';
  for (const [code, message] of Object.entries(RPC_ERROR_MESSAGES)) {
    if (raw.includes(code)) {
      return message;
    }
  }
  if (raw.includes('duplicate key') || raw.includes('23505')) {
    return 'Data yang sama sudah terdaftar. Periksa kembali isian Anda.';
  }
  return fallback;
}
