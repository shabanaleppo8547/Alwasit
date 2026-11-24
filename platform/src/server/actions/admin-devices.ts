'use server';

// إدارة الأجهزة: الموافقة على نقل الحساب لجهاز جديد، رفض الطلب، إلغاء ربط الجهاز.

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/lib/action';
import { requireAdmin } from '../auth/session';
import { db, schema } from '../db';
import { done, fail, handleError, optionalText, parseForm, uuid } from './helpers';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** يلغي اعتماد كل أجهزة الطالب الفعّالة، ويبطل جلساته وتراخيص أجهزته على الخادم. */
async function revokeActiveDevices(tx: Tx, userId: string, adminId: string, reason: string) {
  const revoked = await tx
    .update(schema.devices)
    .set({ status: 'revoked', revokedAt: new Date(), revokedById: adminId, revokeReason: reason })
    .where(and(eq(schema.devices.userId, userId), eq(schema.devices.status, 'active')))
    .returning({ id: schema.devices.id, label: schema.devices.label });
  if (revoked.length) {
    await tx
      .update(schema.offlineLicenses)
      .set({ revokedAt: new Date() })
      .where(and(inArray(schema.offlineLicenses.deviceId, revoked.map((d) => d.id)), isNull(schema.offlineLicenses.revokedAt)));
  }
  await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  return revoked;
}

export async function approveDeviceRequestAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  let userId: string | null = null;
  try {
    userId = await db.transaction(async (tx) => {
      const [req] = await tx
        .select()
        .from(schema.deviceRequests)
        .where(eq(schema.deviceRequests.id, id.data))
        .for('update');
      if (!req || req.status !== 'pending') return null;
      const old = await revokeActiveDevices(tx, req.userId, admin.id, 'نقل إلى جهاز جديد');
      const [device] = await tx
        .insert(schema.devices)
        .values({
          userId: req.userId,
          publicKey: req.publicKey,
          keyId: req.keyId,
          platform: req.platform,
          label: req.label,
          userAgent: req.userAgent,
          approvedById: admin.id,
        })
        .returning({ id: schema.devices.id });
      await tx
        .update(schema.deviceRequests)
        .set({ status: 'approved', decidedAt: new Date(), decidedById: admin.id })
        .where(eq(schema.deviceRequests.id, req.id));
      await tx.insert(schema.auditLogs).values({
        actorId: admin.id,
        action: 'device.transfer_approved',
        targetUserId: req.userId,
        details: { requestId: req.id, newDeviceId: device.id, newLabel: req.label, revoked: old.map((d) => d.label) },
      });
      return req.userId;
    });
  } catch (err) {
    return handleError(err, 'الموافقة على النقل');
  }
  if (!userId) return fail('الطلب غير موجود أو تمت معالجته مسبقًا.');
  revalidatePath('/admin', 'layout');
  return done('تمت الموافقة: أُلغي الجهاز القديم وجلساته، واعتُمد الجهاز الجديد. يستطيع الطالب الدخول منه الآن.');
}

const rejectSchema = z.object({ id: uuid, note: optionalText(300) });

export async function rejectDeviceRequestAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(rejectSchema, fd);
  if (!parsed.ok) return parsed.state;
  try {
    const [req] = await db
      .update(schema.deviceRequests)
      .set({ status: 'rejected', decidedAt: new Date(), decidedById: admin.id, note: parsed.data.note })
      .where(and(eq(schema.deviceRequests.id, parsed.data.id), eq(schema.deviceRequests.status, 'pending')))
      .returning();
    if (!req) return fail('الطلب غير موجود أو تمت معالجته مسبقًا.');
    await db.insert(schema.auditLogs).values({
      actorId: admin.id,
      action: 'device.transfer_rejected',
      targetUserId: req.userId,
      details: { requestId: req.id, label: req.label },
    });
  } catch (err) {
    return handleError(err, 'رفض الطلب');
  }
  revalidatePath('/admin', 'layout');
  return done('تم رفض الطلب. يبقى الجهاز الأصلي معتمدًا.');
}

/** إلغاء ربط الجهاز دون جهاز بديل: أول دخول تالٍ (بكلمة المرور) يعتمد جهازًا جديدًا. */
export async function unbindDeviceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(fd.get('userId'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    await db.transaction(async (tx) => {
      const old = await revokeActiveDevices(tx, id.data, admin.id, 'إلغاء ربط من الإدارة');
      await tx
        .update(schema.deviceRequests)
        .set({ status: 'superseded', decidedAt: new Date(), decidedById: admin.id })
        .where(and(eq(schema.deviceRequests.userId, id.data), eq(schema.deviceRequests.status, 'pending')));
      await tx.insert(schema.auditLogs).values({
        actorId: admin.id,
        action: 'device.unbind',
        targetUserId: id.data,
        details: { revoked: old.map((d) => d.label) },
      });
    });
  } catch (err) {
    return handleError(err, 'إلغاء الربط');
  }
  revalidatePath('/admin', 'layout');
  return done('أُلغي ربط الجهاز وسُجّل خروج الطالب. أول جهاز يدخل منه بكلمة المرور سيُعتمد تلقائيًا.');
}
