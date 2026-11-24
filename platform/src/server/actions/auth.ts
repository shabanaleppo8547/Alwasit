'use server';

import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/lib/action';
import { audit } from '../audit';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../auth/password';
import {
  SESSION_COOKIE,
  createSession,
  destroyAllSessions,
  destroySession,
  getCurrentUser,
  isAdminEmail,
  requireUser,
} from '../auth/session';
import { timingSafeEqual } from 'node:crypto';
import { PROOF_TTL_MS, deviceLabel, devicePlatformOf, issueChallenge, keyIdOf, parseProof, verifyProof } from '../device';
import { newToken, sha256 } from '../auth/tokens';
import { db, schema } from '../db';
import { mailConfigured, sendMail } from '../mail';
import { clear, hit } from '../rate-limit';
import { appUrl, clientInfo } from '../request';
import { done, emailField, fail, handleError, parseForm, passwordField, phoneField, safeNext, trimmed } from './helpers';
import { cookies } from 'next/headers';

const TOO_MANY = 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.';

const registerSchema = z
  .object({
    fullName: trimmed(3, 80, 'الاسم'),
    phone: phoneField,
    email: emailField,
    password: passwordField,
    confirm: z.string(),
    next: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'كلمتا المرور غير متطابقتين.' });

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(registerSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { fullName, phone, email, password, next } = parsed.data;
  const admin = isAdminEmail(email);
  try {
    const { ip, userAgent } = await clientInfo();
    if (!(await hit(`register:${ip}`, 10, 3600))) return fail(TOO_MANY);

    // حساب الطالب يُربط بهذا الجهاز منذ الإنشاء، فلا بد من إثبات مفتاح الجهاز.
    const proof = parseProof(fd);
    if (!admin && (!proof || !(await verifyProof(proof, 'register')))) return fail(DEVICE_ERROR);

    const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    if (exists) return fail('هذا البريد مسجّل مسبقًا. سجّل الدخول أو استعد كلمة المرور.', { email: 'البريد مستخدم.' });

    const passwordHash = await hashPassword(password);
    const { userId, deviceId } = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ fullName, phone, email, role: admin ? 'admin' : 'student', passwordHash, lastLoginAt: new Date() })
        .returning({ id: schema.users.id });
      let deviceId: string | null = null;
      if (!admin && proof) {
        const [d] = await tx
          .insert(schema.devices)
          .values({
            userId: user.id,
            publicKey: proof.publicKey,
            keyId: keyIdOf(proof.publicKey),
            platform: devicePlatformOf(userAgent),
            label: deviceLabel(userAgent),
            userAgent,
            lastSeenAt: new Date(),
          })
          .returning({ id: schema.devices.id });
        deviceId = d.id;
      }
      await tx.insert(schema.auditLogs).values([
        { actorId: user.id, action: 'user.register', targetUserId: user.id, details: { role: admin ? 'admin' : 'student' } },
        ...(deviceId
          ? [{ actorId: user.id, action: 'device.bind', targetUserId: user.id, details: { deviceId, label: deviceLabel(userAgent), ip } }]
          : []),
      ]);
      return { userId: user.id, deviceId };
    });
    await createSession(userId, deviceId);
  } catch (err) {
    return handleError(err, 'إنشاء الحساب');
  }
  redirect(admin ? '/admin-unlock' : safeNext(next, '/dashboard?welcome=1'));
}

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'كلمة المرور مطلوبة.').max(128),
  next: z.string().optional(),
});

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(loginSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { email, password, next } = parsed.data;
  let admin: boolean;
  try {
    const { ip, userAgent } = await clientInfo();
    if (!(await hit(`login-ip:${ip}`, 30, 900)) || !(await hit(`login:${email}`, 8, 900))) return fail(TOO_MANY);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) return fail('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    if (!user.isActive) return fail('هذا الحساب موقوف. تواصل مع إدارة المركز.');

    // الدور يتبع قائمة ADMIN_EMAILS دائمًا (إضافة بريد للقائمة أو حذفه يسري عند الدخول التالي).
    admin = isAdminEmail(email);
    const role = admin ? 'admin' : user.role === 'admin' ? 'student' : user.role;

    let deviceId: string | null = null;
    if (!admin) {
      const proof = parseProof(fd);
      if (!proof || !(await verifyProof(proof, 'login'))) return fail(DEVICE_ERROR);
      const result = await bindOrCheckDevice(user.id, proof.publicKey, { ip, userAgent });
      if (!result.ok) {
        await clear(`login:${email}`);
        return { ...fail(result.message), deviceBlocked: true };
      }
      deviceId = result.deviceId;
    }

    await db.update(schema.users).set({ lastLoginAt: new Date(), role }).where(eq(schema.users.id, user.id));
    await clear(`login:${email}`);
    await createSession(user.id, deviceId);
  } catch (err) {
    return handleError(err, 'تسجيل الدخول');
  }
  redirect(admin ? '/admin-unlock' : safeNext(next, '/dashboard'));
}

/**
 * قلب "جهاز واحد لكل حساب":
 * - لا جهاز معتمد بعد → يُعتمد هذا الجهاز (أول تفعيل موثوق: كلمة مرور صحيحة + مفتاح جهاز).
 * - نفس الجهاز المعتمد → يُسمح.
 * - جهاز مختلف → يُرفض الدخول (حتى مع كلمة المرور الصحيحة)، ولا تُمس جلسات الجهاز الأصلي،
 *   ويُسجَّل طلب نقل للإدارة.
 */
async function bindOrCheckDevice(
  userId: string,
  publicKey: string,
  ctx: { ip: string; userAgent: string },
): Promise<{ ok: true; deviceId: string } | { ok: false; message: string }> {
  const keyId = keyIdOf(publicKey);
  const label = deviceLabel(ctx.userAgent);
  const findActive = () =>
    db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.userId, userId), eq(schema.devices.status, 'active')))
      .limit(1);

  let [active] = await findActive();
  if (!active) {
    try {
      [active] = await db
        .insert(schema.devices)
        .values({ userId, publicKey, keyId, platform: devicePlatformOf(ctx.userAgent), label, userAgent: ctx.userAgent, lastSeenAt: new Date() })
        .returning();
      await audit(userId, 'device.bind', userId, { deviceId: active.id, label, ip: ctx.ip });
      return { ok: true, deviceId: active.id };
    } catch {
      // سباق: جهاز آخر اعتُمد في اللحظة نفسها.
      [active] = await findActive();
      if (!active) throw new Error('device bind failed');
    }
  }

  if (active.keyId === keyId) {
    await db.update(schema.devices).set({ lastSeenAt: new Date() }).where(eq(schema.devices.id, active.id));
    return { ok: true, deviceId: active.id };
  }

  // جهاز مختلف: طلب نقل (واحد معلّق لكل حساب؛ الأحدث يحل محل الأقدم).
  await db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(schema.deviceRequests)
      .where(and(eq(schema.deviceRequests.userId, userId), eq(schema.deviceRequests.status, 'pending')))
      .for('update');
    if (pending?.keyId === keyId) return;
    if (pending) {
      await tx
        .update(schema.deviceRequests)
        .set({ status: 'superseded', decidedAt: new Date() })
        .where(eq(schema.deviceRequests.id, pending.id));
    }
    const [req] = await tx
      .insert(schema.deviceRequests)
      .values({ userId, publicKey, keyId, platform: devicePlatformOf(ctx.userAgent), label, userAgent: ctx.userAgent, ip: ctx.ip })
      .returning({ id: schema.deviceRequests.id });
    await tx.insert(schema.auditLogs).values({
      actorId: userId,
      action: 'device.transfer_request',
      targetUserId: userId,
      details: { requestId: req.id, label, ip: ctx.ip },
    });
  });
  await audit(userId, 'device.login_rejected', userId, { label, ip: ctx.ip });
  return {
    ok: false,
    message:
      'هذا الحساب مرتبط بجهاز آخر، لذا لا يمكن الدخول من هذا الجهاز. أُرسل طلب نقل الحساب إلى هذا الجهاز لإدارة المركز؛ بعد الموافقة سجّل الدخول من هنا مجددًا. جهازك الأصلي يبقى يعمل حتى تتم الموافقة.',
  };
}

/** تحدٍّ لمرة واحدة يوقّعه مفتاح الجهاز قبل الدخول أو التسجيل أو تجديد الإثبات. */
export async function getDeviceChallengeAction(): Promise<{ challenge?: string; error?: string }> {
  const { ip } = await clientInfo();
  if (!(await hit(`challenge:${ip}`, 120, 600))) return { error: TOO_MANY };
  return { challenge: await issueChallenge() };
}

/**
 * تجديد الإثبات قصير العمر للجلسة: الجهاز يوقّع تحديًا جديدًا بمفتاحه،
 * والخادم يتحقق أنه نفس مفتاح الجهاز المعتمد المرتبط بالجلسة.
 */
export async function renewDeviceProofAction(fields: {
  devicePublicKey: string;
  deviceChallenge: string;
  deviceSignature: string;
}): Promise<{ ok: boolean; reason?: 'no_session' | 'mismatch' | 'invalid' }> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, reason: 'no_session' };
  const [row] = await db
    .select({ sessionId: schema.sessions.id, deviceId: schema.devices.id, keyId: schema.devices.keyId, status: schema.devices.status })
    .from(schema.sessions)
    .innerJoin(schema.devices, eq(schema.devices.id, schema.sessions.deviceId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.status !== 'active') return { ok: false, reason: 'no_session' };
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, String(v ?? ''));
  const proof = parseProof(fd);
  if (!proof || keyIdOf(proof.publicKey) !== row.keyId) return { ok: false, reason: 'mismatch' };
  if (!(await verifyProof(proof, 'renew'))) return { ok: false, reason: 'invalid' };
  const now = Date.now();
  await db
    .update(schema.sessions)
    .set({ proofExpiresAt: new Date(now + PROOF_TTL_MS) })
    .where(eq(schema.sessions.id, row.sessionId));
  await db.update(schema.devices).set({ lastSeenAt: new Date(now) }).where(eq(schema.devices.id, row.deviceId));
  return { ok: true };
}

/** فتح لوحة الإدارة بكلمة مرور الإدارة (خطوة ثانية بعد تسجيل الدخول بحساب مدير). */
export async function adminUnlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (!user.adminAccount) redirect('/dashboard?denied=1');
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (expected.length < 8) return fail('كلمة مرور الإدارة غير مضبوطة على الخادم (ADMIN_PASSWORD).');
  try {
    const { ip } = await clientInfo();
    if (!(await hit(`admin-unlock:${user.id}`, 5, 900)) || !(await hit(`admin-unlock-ip:${ip}`, 20, 3600))) {
      return fail(TOO_MANY);
    }
    const given = String(fd.get('adminPassword') ?? '');
    const a = Buffer.from(sha256(given), 'hex');
    const b = Buffer.from(sha256(expected), 'hex');
    if (!timingSafeEqual(a, b)) {
      await audit(user.id, 'admin.unlock_failed', user.id, { ip });
      return fail('كلمة مرور الإدارة غير صحيحة.', { adminPassword: 'غير صحيحة.' });
    }
    await db
      .update(schema.sessions)
      .set({ adminUnlockedUntil: new Date(Date.now() + ADMIN_UNLOCK_HOURS * 3600_000) })
      .where(eq(schema.sessions.id, user.sessionId));
    await clear(`admin-unlock:${user.id}`);
    await audit(user.id, 'admin.unlock', user.id, { ip });
  } catch (err) {
    return handleError(err, 'فتح لوحة الإدارة');
  }
  redirect('/admin');
}

const ADMIN_UNLOCK_HOURS = 8;
const DEVICE_ERROR =
  'تعذّر التحقق من هذا الجهاز. حدّث الصفحة وحاول مجددًا، ولا تستخدم وضع التصفح الخفي.';

export async function logoutAction() {
  await destroySession();
  redirect('/');
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(z.object({ email: emailField }), fd);
  if (!parsed.ok) return parsed.state;
  const { email } = parsed.data;
  try {
    const { ip } = await clientInfo();
    if (!(await hit(`forgot-ip:${ip}`, 10, 3600)) || !(await hit(`forgot:${email}`, 3, 3600))) return fail(TOO_MANY);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (user?.isActive && mailConfigured()) {
      const link = await createResetLink(user.id);
      await sendMail(
        email,
        'استعادة كلمة المرور – مركز الوسيط',
        `<div dir="rtl" style="font-family:sans-serif"><p>مرحبًا ${escapeHtml(user.fullName)}،</p>
         <p>لإعادة تعيين كلمة المرور اضغط الرابط التالي (صالح لمدة ساعة):</p>
         <p><a href="${link}">${link}</a></p><p>إذا لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>`,
      );
    } else if (user?.isActive && process.env.NODE_ENV !== 'production') {
      console.info(`[dev] رابط الاستعادة: ${await createResetLink(user.id)}`);
    }
  } catch (err) {
    return handleError(err, 'طلب الاستعادة');
  }
  // الرسالة نفسها دائمًا حتى لا نكشف البريدات المسجلة.
  return done(
    mailConfigured()
      ? 'إذا كان البريد مسجّلًا لدينا فستصلك رسالة فيها رابط الاستعادة خلال دقائق.'
      : 'تم تسجيل طلبك. إرسال البريد غير مفعّل حاليًا، لذا تواصل مع إدارة المركز لتزويدك برابط الاستعادة.',
  );
}

/** ينشئ رابط استعادة صالحًا لساعة. يُستخدم أيضًا من لوحة الإدارة. */
export async function createResetLink(userId: string, hours = 1): Promise<string> {
  const token = newToken();
  await db.insert(schema.passwordResetTokens).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + hours * 3600_000),
  });
  return `${appUrl()}/reset-password?token=${token}`;
}

const resetSchema = z
  .object({ token: z.string().min(20).max(200), password: passwordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'كلمتا المرور غير متطابقتين.' });

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(resetSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { token, password } = parsed.data;
  try {
    const t = schema.passwordResetTokens;
    const [row] = await db
      .update(t)
      .set({ usedAt: new Date() })
      .where(and(eq(t.id, sha256(token)), isNull(t.usedAt), gt(t.expiresAt, new Date())))
      .returning({ userId: t.userId });
    if (!row) return fail('رابط الاستعادة غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.');
    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(schema.users.id, row.userId));
    await destroyAllSessions(row.userId);
    await audit(row.userId, 'user.password_reset', row.userId);
  } catch (err) {
    return handleError(err, 'تعيين كلمة المرور');
  }
  redirect('/login?reset=1');
}

const profileSchema = z.object({ fullName: trimmed(3, 80, 'الاسم'), phone: phoneField });

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/account');
  const parsed = parseForm(profileSchema, fd);
  if (!parsed.ok) return parsed.state;
  try {
    await db.update(schema.users).set(parsed.data).where(eq(schema.users.id, user.id));
  } catch (err) {
    return handleError(err, 'حفظ البيانات');
  }
  return done('تم حفظ بياناتك.');
}

const changePasswordSchema = z
  .object({ current: z.string().min(1, 'أدخل كلمة المرور الحالية.'), password: passwordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'كلمتا المرور غير متطابقتين.' });

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/account');
  const parsed = parseForm(changePasswordSchema, fd);
  if (!parsed.ok) return parsed.state;
  try {
    if (!(await hit(`chpw:${user.id}`, 8, 900))) return fail(TOO_MANY);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    if (!(await verifyPassword(parsed.data.current, row.passwordHash))) {
      return fail('كلمة المرور الحالية غير صحيحة.', { current: 'غير صحيحة.' });
    }
    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(parsed.data.password) })
      .where(eq(schema.users.id, user.id));
    // إخراج كل الأجهزة الأخرى.
    const current = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
    await db
      .delete(schema.sessions)
      .where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, sha256(current))));
    await audit(user.id, 'user.password_change', user.id);
  } catch (err) {
    return handleError(err, 'تغيير كلمة المرور');
  }
  return done('تم تغيير كلمة المرور، وتم تسجيل الخروج من الأجهزة الأخرى.');
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
