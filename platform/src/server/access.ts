import 'server-only';
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { db, schema } from './db';
import type { SessionUser } from './auth/session';

const { enrollments, bundleLectures, bundles, lectures, subjects } = schema;

/** شرط الاشتراك الساري: فعّال ولم تنتهِ مدته. */
export function activeEnrollmentWhere(userId: string) {
  return and(
    eq(enrollments.userId, userId),
    eq(enrollments.status, 'active'),
    or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, new Date())),
  );
}

export type AccessSummary = {
  /** مواد كاملة مفعّلة مع تاريخ الانتهاء. */
  subjects: Map<string, Date | null>;
  /** محاضرات مفعّلة عبر الحزم. */
  lectureIds: Set<string>;
  /** المواد التي فيها حزمة واحدة على الأقل مفعّلة (تفعيل جزئي). */
  partialSubjectIds: Set<string>;
};

export async function getAccessSummary(userId: string): Promise<AccessSummary> {
  const rows = await db
    .select({ subjectId: enrollments.subjectId, bundleId: enrollments.bundleId, expiresAt: enrollments.expiresAt })
    .from(enrollments)
    .where(activeEnrollmentWhere(userId));

  const summary: AccessSummary = { subjects: new Map(), lectureIds: new Set(), partialSubjectIds: new Set() };
  const bundleIds: string[] = [];
  for (const r of rows) {
    if (r.subjectId) summary.subjects.set(r.subjectId, r.expiresAt);
    if (r.bundleId) bundleIds.push(r.bundleId);
  }
  if (bundleIds.length) {
    const bl = await db
      .select({ lectureId: bundleLectures.lectureId, subjectId: bundles.subjectId })
      .from(bundleLectures)
      .innerJoin(bundles, eq(bundles.id, bundleLectures.bundleId))
      .where(inArray(bundleLectures.bundleId, bundleIds));
    for (const b of bl) {
      summary.lectureIds.add(b.lectureId);
      summary.partialSubjectIds.add(b.subjectId);
    }
  }
  return summary;
}

export function lectureUnlocked(
  user: SessionUser | null,
  lecture: { id: string; subjectId: string; isFree: boolean },
  access: AccessSummary | null,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (lecture.isFree) return true;
  if (!access) return false;
  return access.subjects.has(lecture.subjectId) || access.lectureIds.has(lecture.id);
}

/**
 * التحقق النهائي من صلاحية مشاهدة محاضرة، من قاعدة البيانات مباشرة.
 * يُستخدم في مسار البث وصفحة المشغّل. يعيد المحاضرة مع مرجع الفيديو فقط عند السماح.
 */
export async function authorizeLecture(user: SessionUser | null, lectureId: string) {
  if (!user) return { ok: false as const, reason: 'unauthenticated' as const };
  const [lecture] = await db
    .select({
      id: lectures.id,
      subjectId: lectures.subjectId,
      isFree: lectures.isFree,
      videoRef: lectures.videoRef,
      lecturePublished: lectures.isPublished,
      subjectPublished: subjects.isPublished,
    })
    .from(lectures)
    .innerJoin(subjects, eq(subjects.id, lectures.subjectId))
    .where(eq(lectures.id, lectureId))
    .limit(1);
  if (!lecture) return { ok: false as const, reason: 'not_found' as const };
  const isAdmin = user.role === 'admin';
  if (!isAdmin && (!lecture.lecturePublished || !lecture.subjectPublished)) {
    return { ok: false as const, reason: 'not_found' as const };
  }
  if (isAdmin || lecture.isFree) return { ok: true as const, lecture };

  const [direct] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(activeEnrollmentWhere(user.id), eq(enrollments.subjectId, lecture.subjectId)))
    .limit(1);
  if (direct) return { ok: true as const, lecture };

  const [viaBundle] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(bundleLectures, eq(bundleLectures.bundleId, enrollments.bundleId))
    .where(and(activeEnrollmentWhere(user.id), eq(bundleLectures.lectureId, lecture.id)))
    .limit(1);
  if (viaBundle) return { ok: true as const, lecture };

  return { ok: false as const, reason: 'forbidden' as const };
}
