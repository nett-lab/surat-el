import { describe, it, expect } from 'vitest';
import {
  timingSafeEqualString,
  generateTempPassword,
  isValidPdfBuffer,
  sha256Hex,
} from '../../src/lib/utils/security.js';
import { mapRpcError } from '../../src/lib/utils/format.js';
import {
  composeLetterSchema,
  tenantRequestSchema,
  passwordChangeSchema,
} from '../../src/lib/validation/schemas.js';

describe('security utilities', () => {
  it('timingSafeEqualString membandingkan string secara akurat', () => {
    expect(timingSafeEqualString('secret-123', 'secret-123')).toBe(true);
    expect(timingSafeEqualString('secret-123', 'secret-124')).toBe(false);
    expect(timingSafeEqualString('short', 'longer')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(false);
  });

  it('generateTempPassword menghasilkan sandi kuat dengan huruf, angka, dan simbol', () => {
    const pw = generateTempPassword(14);
    expect(pw.length).toBe(14);
    expect(/[A-Z]/.test(pw)).toBe(true);
    expect(/[a-z]/.test(pw)).toBe(true);
    expect(/[0-9]/.test(pw)).toBe(true);
    expect(/[!@#$%&*]/.test(pw)).toBe(true);
  });

  it('isValidPdfBuffer memeriksa magic bytes %PDF-', () => {
    expect(isValidPdfBuffer(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isValidPdfBuffer(Buffer.from('<html>not a pdf</html>'))).toBe(false);
    expect(isValidPdfBuffer(Buffer.from(''))).toBe(false);
  });

  it('sha256Hex konsisten untuk token pairing Telegram', () => {
    expect(sha256Hex('abc')).toHaveLength(64);
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
  });
});

describe('error mapper & zod validation', () => {
  it('mapRpcError tidak membocorkan detail SQL mentah', () => {
    expect(mapRpcError({ message: 'ERROR: MEMO_NOT_OWNED' })).toContain('menutup surat');
    expect(mapRpcError({ message: 'FATAL: relation "secret" does not exist' })).toBe(
      'Terjadi kesalahan saat memproses permintaan.'
    );
  });

  it('tenantRequestSchema menolak slug tidak valid dan menerima slug sah', () => {
    const bad = tenantRequestSchema.safeParse({
      org_name: 'Dinas A',
      slug: 'INVALID SLUG!',
      admin_name: 'Budi',
      admin_email: 'budi@dinas.go.id',
    });
    expect(bad.success).toBe(false);

    const good = tenantRequestSchema.safeParse({
      org_name: 'Dinas Kominfo',
      slug: 'diskominfo-kota',
      admin_name: 'Budi',
      admin_email: 'budi@dinas.go.id',
    });
    expect(good.success).toBe(true);
  });

  it('composeLetterSchema mewajibkan minimal 1 penerima dan 1 dokumen', () => {
    const res = composeLetterSchema.safeParse({
      sender: 'Kementerian',
      letter_date: '2026-11-20',
      receipt_date: '2026-11-21',
      subject: 'Undangan Rapat',
      category: 'invitation',
      security_class: 'B',
      received_via: 'email',
      classification_code: '005',
      agenda_year: 2026,
      recipient_position_ids: [],
      docs: [],
    });
    expect(res.success).toBe(false);
  });

  it('passwordChangeSchema memeriksa kecocokan konfirmasi', () => {
    expect(
      passwordChangeSchema.safeParse({ password: 'Password1', confirmPassword: 'Password2' }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({ password: 'Password1', confirmPassword: 'Password1' }).success
    ).toBe(true);
  });
});
