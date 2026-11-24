import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { db, schema } from './db';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | PgTransaction<any, any, any>;

export type GrantInput = {
  userId: string;
  subjectId: string | null;
  bundleId: string | null;
  source: 'admin' | 'code';
  /** عدد أيام الصلاحية؛ null = بلا انتهاء. */
  days: number | null;
  grantedById: string | null;
  note?: string | null;
};

/**
 * يمنح اشتراكًا أو يجدّده. إن وُجد اشتراك سابق للهدف نفسه يُعاد تفعيله،
 * وتُمدَّد المدة من تاريخ الانتهاء الحالي إن كان ما زال ساريًا (لا يخسر الطالب أيامه).
 */
export async function grantEnrollment(tx: Tx, input: GrantInput) {
  const t = schema.enrollments;
  const target = input.subjectId ? eq(t.subjectId, input.subjectId) : eq(t.bundleId, input.bundleId!);
  const [existing] = await (tx as typeof db)
    .select()
    .from(t)
    .where(and(eq(t.userId, input.userId), target))
    .for('update')
    .limit(1);

  const now = new Date();
  const computeExpiry = (base: Date) =>
    input.days == null ? null : new Date(base.getTime() + input.days * 86400_000);

  if (existing) {
    const stillActive =
      existing.status === 'active' && (existing.expiresAt == null || existing.expiresAt > now);
    let expiresAt: Date | null;
    if (input.days == null) expiresAt = null;
    else if (stillActive && existing.expiresAt == null) expiresAt = null; // لا نقصّر اشتراكًا دائمًا
    else expiresAt = computeExpiry(stillActive && existing.expiresAt ? existing.expiresAt : now);

    const [row] = await (tx as typeof db)
      .update(t)
      .set({
        status: 'active',
        source: input.source,
        expiresAt,
        activatedAt: stillActive ? existing.activatedAt : now,
        grantedById: input.grantedById,
        note: input.note ?? existing.note,
      })
      .where(eq(t.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await (tx as typeof db)
    .insert(t)
    .values({
      userId: input.userId,
      subjectId: input.subjectId,
      bundleId: input.bundleId,
      source: input.source,
      expiresAt: computeExpiry(now),
      grantedById: input.grantedById,
      note: input.note ?? null,
    })
    .returning();
  return row;
}
