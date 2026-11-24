import 'server-only';
import { randomInt } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from './db';
import { grantEnrollment } from './enrollments';
import { normalizeCode } from '@/lib/codes';

// أحرف بلا التباس (لا 0/O ولا 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** رمز بصيغة ALW-XXXX-XXXX-XXXX (≈ 59 بت عشوائية آمنة تشفيريًا). */
export function generateCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(s);
  }
  return `ALW-${groups.join('-')}`;
}

export type RedeemResult =
  | { ok: true; subjectId: string; expiresAt: Date | null }
  | { ok: false; message: string };

/**
 * تفعيل رمز لطالب داخل معاملة واحدة مع قفل صف الرمز،
 * فلا يمكن تجاوز الحد المسموح حتى مع طلبات متزامنة.
 */
export async function redeemCode(userId: string, rawCode: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, message: 'صيغة الرمز غير صحيحة. مثال: ALW-ABCD-EFGH-JKMN' };

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: schema.activationCodes.id,
        usesCount: schema.activationCodes.usesCount,
        isDisabled: schema.activationCodes.isDisabled,
        maxUses: schema.codeBatches.maxUsesPerCode,
        accessDays: schema.codeBatches.accessDays,
        redeemBefore: schema.codeBatches.redeemBefore,
        subjectId: schema.codeBatches.subjectId,
        bundleId: schema.codeBatches.bundleId,
      })
      .from(schema.activationCodes)
      .innerJoin(schema.codeBatches, eq(schema.codeBatches.id, schema.activationCodes.batchId))
      .where(eq(schema.activationCodes.code, code))
      .for('update', { of: schema.activationCodes })
      .limit(1);

    const invalid = { ok: false as const, message: 'الرمز غير صحيح أو غير صالح.' };
    if (!row || row.isDisabled) return invalid;
    if (row.redeemBefore && row.redeemBefore < new Date()) {
      return { ok: false as const, message: 'انتهت مدة استخدام هذا الرمز.' };
    }

    const [already] = await tx
      .select({ id: schema.codeRedemptions.id })
      .from(schema.codeRedemptions)
      .where(and(eq(schema.codeRedemptions.codeId, row.id), eq(schema.codeRedemptions.userId, userId)))
      .limit(1);
    if (already) return { ok: false as const, message: 'استخدمت هذا الرمز من قبل على حسابك.' };
    if (row.usesCount >= row.maxUses) return { ok: false as const, message: 'هذا الرمز مستخدم بالكامل.' };

    const enrollment = await grantEnrollment(tx, {
      userId,
      subjectId: row.subjectId,
      bundleId: row.bundleId,
      source: 'code',
      days: row.accessDays,
      grantedById: null,
      note: `رمز ${code}`,
    });

    await tx.insert(schema.codeRedemptions).values({ codeId: row.id, userId, enrollmentId: enrollment.id });
    await tx
      .update(schema.activationCodes)
      .set({ usesCount: sql`${schema.activationCodes.usesCount} + 1` })
      .where(eq(schema.activationCodes.id, row.id));
    await tx.insert(schema.auditLogs).values({
      actorId: userId,
      action: 'code.redeem',
      targetUserId: userId,
      details: { code, subjectId: row.subjectId, bundleId: row.bundleId },
    });

    let subjectId = row.subjectId;
    if (!subjectId && row.bundleId) {
      const [b] = await tx
        .select({ subjectId: schema.bundles.subjectId })
        .from(schema.bundles)
        .where(eq(schema.bundles.id, row.bundleId));
      subjectId = b?.subjectId ?? null;
    }
    return { ok: true as const, subjectId: subjectId!, expiresAt: enrollment.expiresAt };
  });
}

