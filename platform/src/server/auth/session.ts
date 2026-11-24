import 'server-only';
import { and, eq, gt, lt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db, schema } from '../db';
import { clientInfo } from '../request';
import { newToken, sha256 } from './tokens';

export const SESSION_COOKIE = 'alw_session';
const SESSION_DAYS = 30;

export type SessionUser = Pick<
  schema.User,
  'id' | 'email' | 'fullName' | 'phone' | 'role' | 'createdAt'
>;

export async function createSession(userId: string) {
  const token = newToken();
  const { ip, userAgent } = await clientInfo();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt, ip, userAgent });
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

/** المستخدم الحالي (مرة واحدة لكل طلب). الحسابات الموقوفة تُعامل كغير مسجلة. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      phone: schema.users.phone,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
      isActive: schema.users.isActive,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || !row.isActive) return null;
  const { isActive: _ignored, ...user } = row;
  return user;
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  return user;
}

/** حارس لوحة الإدارة: يُستدعى في كل صفحة وكل إجراء خادم إداري. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin') redirect('/dashboard?denied=1');
  return user;
}

export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
