'use server';

// إدارة الطلاب والاشتراكات ورموز التفعيل.

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/lib/action';
import { audit } from '../audit';
import { destroyAllSessions, requireAdmin } from '../auth/session';
import { generateCode } from '../codes';
import { db, schema } from '../db';
import { grantEnrollment } from '../enrollments';
import { createResetLink } from './auth';
import { done, fail, handleError, intField, optionalInt, optionalText, parseForm, trimmed, uuid } from './helpers';

/** "subject:<uuid>" أو "bundle:<uuid>" */
const targetField = z
  .string({ error: 'اختر المادة أو الحزمة.' })
  .regex(/^(subject|bundle):[0-9a-f-]{36}$/i, 'اختر المادة أو الحزمة.')
  .transform((v) => {
    const [kind, id] = v.split(':');
    return kind === 'subject' ? { subjectId: id, bundleId: null } : { subjectId: null, bundleId: id };
  });

const grantSchema = z.object({
  userId: uuid,
  target: targetField,
  days: optionalInt('عدد الأيام', 1, 3650),
  note: optionalText(300),
});

export async function grantEnrollmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(grantSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { userId, target, days, note } = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const e = await grantEnrollment(tx, { userId, ...target, source: 'admin', days, grantedById: admin.id, note });
      await tx.insert(schema.auditLogs).values({
        actorId: admin.id,
        action: 'enrollment.grant',
        targetUserId: userId,
        details: { ...target, days, enrollmentId: e.id },
      });
    });
  } catch (err) {
    return handleError(err, 'تفعيل الاشتراك');
  }
  revalidatePath(`/admin/students/${userId}`);
  return done('تم تفعيل الاشتراك للطالب.');
}

export async function setEnrollmentStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(z.object({ id: uuid, status: z.enum(['active', 'revoked']) }), fd);
  if (!parsed.ok) return parsed.state;
  const { id, status } = parsed.data;
  let userId: string;
  try {
    const [row] = await db
      .update(schema.enrollments)
      .set({ status, grantedById: admin.id })
      .where(eq(schema.enrollments.id, id))
      .returning({ userId: schema.enrollments.userId });
    if (!row) return fail('الاشتراك غير موجود.');
    userId = row.userId;
    await audit(admin.id, status === 'revoked' ? 'enrollment.revoke' : 'enrollment.restore', userId, { enrollmentId: id });
  } catch (err) {
    return handleError(err, 'تعديل الاشتراك');
  }
  revalidatePath(`/admin/students/${userId}`);
  return done(status === 'revoked' ? 'تم إلغاء الصلاحية.' : 'تمت إعادة تفعيل الصلاحية.');
}

export async function setUserActiveAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(z.object({ id: uuid, active: z.enum(['true', 'false']) }), fd);
  if (!parsed.ok) return parsed.state;
  const { id } = parsed.data;
  const active = parsed.data.active === 'true';
  if (id === admin.id) return fail('لا يمكنك إيقاف حسابك.');
  try {
    await db.update(schema.users).set({ isActive: active }).where(eq(schema.users.id, id));
    if (!active) await destroyAllSessions(id);
    await audit(admin.id, active ? 'user.activate' : 'user.deactivate', id);
  } catch (err) {
    return handleError(err, 'تعديل الحساب');
  }
  revalidatePath(`/admin/students/${id}`);
  return done(active ? 'تم تفعيل الحساب.' : 'تم إيقاف الحساب وتسجيل خروجه من كل الأجهزة.');
}

/** للمراكز التي لا تعتمد على البريد: المدير يولّد رابطًا ويرسله للطالب عبر واتساب. */
export async function adminResetLinkAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    const link = await createResetLink(id.data, 24);
    await audit(admin.id, 'user.reset_link', id.data);
    return { ...done('رابط الاستعادة (صالح 24 ساعة، لمرة واحدة). أرسله للطالب فقط:'), href: link };
  } catch (err) {
    return handleError(err, 'إنشاء الرابط');
  }
}

// ---------- رموز التفعيل ----------

const batchSchema = z.object({
  name: trimmed(2, 100, 'اسم الدفعة'),
  target: targetField,
  count: intField('عدد الرموز', 1, 500),
  maxUsesPerCode: intField('عدد الاستخدامات', 1, 1000),
  accessDays: optionalInt('مدة الصلاحية', 1, 3650),
  redeemBefore: z
    .string()
    .optional()
    .transform((s) => (s ? new Date(`${s}T23:59:59`) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), 'تاريخ غير صالح.'),
});

export async function createCodeBatchAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(batchSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { target, count, ...rest } = parsed.data;
  let batchId: string;
  try {
    batchId = await db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(schema.codeBatches)
        .values({ ...rest, ...target, createdById: admin.id })
        .returning({ id: schema.codeBatches.id });
      const codes = new Set<string>();
      while (codes.size < count) codes.add(generateCode());
      await tx.insert(schema.activationCodes).values([...codes].map((code) => ({ batchId: batch.id, code })));
      return batch.id;
    });
    await audit(admin.id, 'codes.create', null, { batchId, count, ...target });
  } catch (err) {
    return handleError(err, 'إنشاء الرموز');
  }
  revalidatePath('/admin/codes');
  redirect(`/admin/codes/${batchId}`);
}

export async function toggleCodeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(z.object({ id: uuid, disabled: z.enum(['true', 'false']) }), fd);
  if (!parsed.ok) return parsed.state;
  const disabled = parsed.data.disabled === 'true';
  try {
    const [row] = await db
      .update(schema.activationCodes)
      .set({ isDisabled: disabled })
      .where(eq(schema.activationCodes.id, parsed.data.id))
      .returning({ batchId: schema.activationCodes.batchId });
    if (row) revalidatePath(`/admin/codes/${row.batchId}`);
  } catch (err) {
    return handleError(err, 'تعديل الرمز');
  }
  return done(disabled ? 'تم تعطيل الرمز.' : 'تم تفعيل الرمز.');
}

export async function deleteCodeBatchAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    // حذف الدفعة لا يلغي الاشتراكات التي فُعّلت بها مسبقًا.
    await db.delete(schema.codeBatches).where(and(eq(schema.codeBatches.id, id.data)));
    await audit(admin.id, 'codes.delete_batch', null, { batchId: id.data });
  } catch (err) {
    return handleError(err, 'حذف الدفعة');
  }
  revalidatePath('/admin/codes');
  redirect('/admin/codes');
}
