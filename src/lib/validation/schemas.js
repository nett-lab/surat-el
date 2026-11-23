import { z } from 'zod';

const uuid = z.string().uuid('Format ID tidak valid.');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

export const loginSchema = z.object({
  tenantSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]*$/, 'Kode instansi hanya boleh huruf kecil, angka, dan tanda hubung.')
    .optional()
    .or(z.literal('')),
  identifier: z.string().trim().min(3, 'Masukkan username atau email.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

export const tenantRequestSchema = z.object({
  org_name: z.string().trim().min(3, 'Nama instansi minimal 3 karakter.').max(150),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Kode instansi harus 3–40 karakter huruf kecil, angka, atau tanda hubung.'),
  admin_name: z.string().trim().min(2, 'Nama admin minimal 2 karakter.').max(120),
  admin_email: z.string().trim().email('Alamat email tidak valid.').max(255),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const composeLetterSchema = z.object({
  sender: z.string().trim().min(1, 'Pengirim wajib diisi.').max(150),
  number: z.string().trim().max(100).optional().or(z.literal('')),
  letter_date: isoDate,
  receipt_date: isoDate,
  subject: z.string().trim().min(1, 'Perihal surat wajib diisi.').max(1000),
  category: z.enum(['primary', 'invitation'], { message: 'Pilih kategori surat.' }),
  security_class: z.enum(['SR', 'R', 'T', 'B'], { message: 'Pilih klasifikasi keamanan.' }),
  received_via: z.enum(['email', 'physical', 'internal', 'other'], { message: 'Pilih sumber penerimaan.' }),
  classification_code: z.string().trim().min(1, 'Kode klasifikasi wajib dipilih.').max(10),
  agenda_year: z.coerce.number().int().min(1990).max(2100),
  recipient_position_ids: z.array(uuid).min(1, 'Pilih minimal satu jabatan penerima.'),
  instruction: z.string().trim().max(2000).optional().or(z.literal('')),
  docs: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(255),
        path: z.string().trim().min(1).max(500),
      })
    )
    .min(1, 'Unggah minimal satu lampiran PDF.'),
});

export const updateLetterMetaSchema = z.object({
  sender: z.string().trim().min(1, 'Pengirim wajib diisi.').max(150),
  number: z.string().trim().max(100).optional().or(z.literal('')),
  letter_date: isoDate,
  receipt_date: isoDate,
  category: z.enum(['primary', 'invitation']),
  security_class: z.enum(['SR', 'R', 'T', 'B']),
  received_via: z.enum(['email', 'physical', 'internal', 'other']),
  subject: z.string().trim().min(1, 'Perihal wajib diisi.').max(1000),
});

export const updateRecipientsSchema = z.object({
  recipients: z
    .array(
      z.object({
        id: uuid.optional().nullable(),
        to_position_id: uuid,
        instruction: z.string().trim().max(500).optional().or(z.literal('')),
      })
    )
    .min(1, 'Minimal satu penerima wajib ada.'),
});

export const createFlowSchema = z.object({
  kind: z.enum(['disposition', 'memo']),
  root_flow_id: uuid,
  to_positions: z.array(uuid).min(1, 'Pilih minimal satu jabatan tujuan.'),
  cc_positions: z.array(uuid).optional().default([]),
  instruction: z.string().trim().max(2000).optional().or(z.literal('')),
  followups: z.array(z.string().trim().min(1).max(200)).optional().default([]),
  docs: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(255),
        path: z.string().trim().min(1).max(500),
      })
    )
    .optional()
    .default([]),
});

export const closeLetterSchema = z.object({
  memo_flow_id: uuid,
  to_position_id: uuid,
  note: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(150),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,50}$/, 'Username 3–50 karakter (huruf kecil, angka, titik, underscore, strip).'),
  email: z.string().trim().email('Format email tidak valid.').max(255).optional().or(z.literal('')),
  position_id: uuid,
  role_id: uuid,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(150),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,50}$/),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  is_active: z.boolean(),
});

export const positionSchema = z.object({
  name: z.string().trim().min(2, 'Nama jabatan minimal 2 karakter.').max(150),
  parent_id: uuid.optional().nullable().or(z.literal('')),
  is_active: z.boolean().optional().default(true),
});

export const classificationSchema = z.object({
  code: z.string().trim().regex(/^[0-9A-Za-z.]{1,10}$/, 'Kode klasifikasi 1–10 karakter alfanumerik/titik.'),
  name: z.string().trim().min(2, 'Nama klasifikasi wajib diisi.').max(150),
  is_active: z.boolean().optional().default(true),
});

export const followupSchema = z.object({
  name: z.string().trim().min(2, 'Nama tindak lanjut wajib diisi.').max(150),
  is_active: z.boolean().optional().default(true),
});

export const roleSchema = z.object({
  name: z.string().trim().min(2, 'Nama role wajib diisi.').max(100),
  permissions: z.array(z.string()).default([]),
});

export const passwordChangeSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter.')
      .regex(/[A-Za-z]/, 'Harus mengandung huruf.')
      .regex(/[0-9]/, 'Harus mengandung angka.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi kata sandi tidak cocok.',
  });

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(150),
  email: z.string().trim().email('Email tidak valid.').max(255).optional().or(z.literal('')),
});
