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
  isAdminEmail,
  requireUser,
} from '../auth/session';
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
  try {
    const { ip } = await clientInfo();
    if (!(await hit(`register:${ip}`, 10, 3600))) return fail(TOO_MANY);

    const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    if (exists) return fail('هذا البريد مسجّل مسبقًا. سجّل الدخول أو استعد كلمة المرور.', { email: 'البريد مستخدم.' });

    const role = isAdminEmail(email) ? 'admin' : 'student';
    const [user] = await db
      .insert(schema.users)
      .values({ fullName, phone, email, role, passwordHash: await hashPassword(password), lastLoginAt: new Date() })
      .returning({ id: schema.users.id });
    await audit(user.id, 'user.register', user.id, { role });
    await createSession(user.id);
  } catch (err) {
    return handleError(err, 'إنشاء الحساب');
  }
  redirect(safeNext(next, '/dashboard?welcome=1'));
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
  let role: string;
  try {
    const { ip } = await clientInfo();
    if (!(await hit(`login-ip:${ip}`, 30, 900)) || !(await hit(`login:${email}`, 8, 900))) return fail(TOO_MANY);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) return fail('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    if (!user.isActive) return fail('هذا الحساب موقوف. تواصل مع إدارة المركز.');

    await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
    await clear(`login:${email}`);
    await createSession(user.id);
    role = user.role;
  } catch (err) {
    return handleError(err, 'تسجيل الدخول');
  }
  redirect(safeNext(next, role === 'admin' ? '/admin' : '/dashboard'));
}

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
