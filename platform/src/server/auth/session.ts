import 'server-only';
import { and, eq, gt, lt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db, schema } from '../db';
import { clientInfo } from '../request';
import { newToken, sha256 } from './tokens';
import { PROOF_TTL_MS } from '../device';

export const SESSION_COOKIE = 'alw_session';
const SESSION_DAYS = 30;

export type SessionUser = Pick<
  schema.User,
  'id' | 'email' | 'fullName' | 'phone' | 'role' | 'createdAt'
> & {
  sessionId: string;
  deviceId: string | null;
  /** إثبات امتلاك مفتاح الجهاز ما زال ضمن عمره القصير. */
  proofFresh: boolean;
  /** حساب مدير (بريد ضمن ADMIN_EMAILS). صلاحيات المدير الفعلية لا تعمل قبل adminUnlocked. */
  adminAccount: boolean;
  /** فُتحت لوحة الإدارة بكلمة مرور الإدارة في هذه الجلسة. role = 'admin' فقط عندها. */
  adminUnlocked: boolean;
};

/** المدير = حساب بدور admin وبريده ضمن ADMIN_EMAILS معًا. */
export function isAdminUser(u: { role: string; email: string }) {
  return u.role === 'admin' && isAdminEmail(u.email);
}

export async function createSession(userId: string, deviceId: string | null) {
  const token = newToken();
  const { ip, userAgent } = await clientInfo();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    ip,
    userAgent,
    deviceId,
    proofExpiresAt: deviceId ? new Date(Date.now() + PROOF_TTL_MS) : null,
  });
  // تنظيف الجلسات المنتهية لهذا المستخدم.
  await db
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), lt(schema.sessions.expiresAt, new Date())));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

/**
 * المستخدم الحالي (مرة واحدة لكل طلب). يُرفض إذا:
 * - الجلسة منتهية أو الحساب موقوف،
 * - أو الطالب وجلسته غير مرتبطة بجهازه المعتمد الحالي (أي جهاز أُلغي اعتماده تسقط جلساته فورًا).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = new Date();
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      phone: schema.users.phone,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
      isActive: schema.users.isActive,
      sessionId: schema.sessions.id,
      deviceId: schema.sessions.deviceId,
      proofExpiresAt: schema.sessions.proofExpiresAt,
      adminUnlockedUntil: schema.sessions.adminUnlockedUntil,
      deviceStatus: schema.devices.status,
      deviceUserId: schema.devices.userId,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.devices, eq(schema.devices.id, schema.sessions.deviceId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, now)))
    .limit(1);
  if (!row || !row.isActive) return null;

  const admin = isAdminUser(row);
  if (!admin) {
    // الطالب: يجب أن تكون الجلسة على جهازه المعتمد الفعّال.
    if (!row.deviceId || row.deviceStatus !== 'active' || row.deviceUserId !== row.id) return null;
  }
  const unlocked = admin && Boolean(row.adminUnlockedUntil && row.adminUnlockedUntil > now);
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    // صلاحيات المدير (رؤية كل المحتوى، اللوحة) تعمل فقط بعد إدخال كلمة مرور الإدارة.
    role: unlocked ? 'admin' : row.role === 'admin' ? 'student' : row.role,
    createdAt: row.createdAt,
    sessionId: row.sessionId,
    deviceId: row.deviceId,
    proofFresh: admin || Boolean(row.proofExpiresAt && row.proofExpiresAt > now),
    adminAccount: admin,
    adminUnlocked: unlocked,
  };
});

/** للصفحات والإجراءات المحمية: يتطلب جلسة على الجهاز المعتمد وإثباتًا حديثًا لمفتاحه. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  const target = next ?? '/dashboard';
  if (!user) redirect(`/login?next=${encodeURIComponent(target)}`);
  if (!user.proofFresh) redirect(`/device-check?next=${encodeURIComponent(target)}`);
  return user;
}

/**
 * حارس لوحة الإدارة: يُستدعى في كل صفحة وكل إجراء إداري.
 * يشترط: بريد ضمن ADMIN_EMAILS + دور مدير + إدخال كلمة مرور الإدارة في هذه الجلسة.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (!user.adminAccount) redirect('/dashboard?denied=1');
  if (!user.adminUnlocked) redirect('/admin-unlock');
  return user;
}

export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
