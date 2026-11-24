import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LectureList } from '@/components/lecture-list';
import { VideoPlayer } from '@/components/video-player';
import { authorizeLecture, getAccessSummary, lectureUnlocked } from '@/server/access';
import { requireUser } from '@/server/auth/session';
import { getSubjectDetail } from '@/server/queries';
import { formatDuration } from '@/lib/format';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(`/lectures/${id}`);
  const auth = await authorizeLecture(user, id);
  if (!auth.ok && auth.reason === 'not_found') notFound();

  const subjectId = auth.ok ? auth.lecture.subjectId : null;
  // في حالة المنع نحتاج المادة لعرض شاشة القفل؛ نجلبها عبر المحاضرة.
  const detail = subjectId
    ? await getSubjectDetail(subjectId, { includeHidden: user.role === 'admin' })
    : await findSubjectForLecture(id);
  if (!detail) notFound();
  const access = await getAccessSummary(user.id);
  const items = detail.lectures.map((l) => ({ ...l, unlocked: lectureUnlocked(user, l, access) }));
  const idx = items.findIndex((l) => l.id === id);
  if (idx < 0) notFound();
  const lecture = detail.lectures[idx];
  const prev = items.slice(0, idx).reverse().find((l) => l.unlocked);
  const next = items.slice(idx + 1).find((l) => l.unlocked);

  return (
    <div className="page py-6 sm:py-10">
      <nav className="mb-4 text-sm text-ink-soft" aria-label="مسار التنقل">
        <Link href={`/subjects/${detail.subject.id}`} className="hover:text-ink">
          {detail.subject.title}
        </Link>
        <span className="mx-2">/</span>
        <span>المحاضرة {idx + 1}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {auth.ok ? (
            <VideoPlayer src={`/api/stream/${id}`} watermark={`${user.email} · ${user.phone}`} />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-2xl bg-ink p-6 text-center text-white">
              <span className="text-4xl">🔒</span>
              <p className="text-lg font-bold">هذه المحاضرة غير مفعّلة على حسابك</p>
              <p className="max-w-sm text-sm text-white/70">فعّل المادة برمز التفعيل الذي حصلت عليه من المركز.</p>
              <Link href="/redeem" className="btn-amber">
                إدخال رمز التفعيل
              </Link>
            </div>
          )}

          <div className="mt-5">
            <h1 className="text-xl font-bold sm:text-2xl">{lecture.title}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {detail.subject.teacherName && <>أ. {detail.subject.teacherName} · </>}
              {detail.subject.title}
              {formatDuration(lecture.durationSeconds) && (
                <>
                  {' · '}
                  <span className="ltr-nums">{formatDuration(lecture.durationSeconds)}</span>
                </>
              )}
            </p>
            {lecture.description && <p className="mt-4 leading-8 whitespace-pre-line text-ink-soft">{lecture.description}</p>}
          </div>

          <div className="mt-6 flex gap-3">
            {prev && (
              <Link href={`/lectures/${prev.id}`} className="btn-ghost flex-1 sm:flex-none">
                → السابقة
              </Link>
            )}
            {next && (
              <Link href={`/lectures/${next.id}`} className="btn-primary flex-1 sm:flex-none">
                التالية ←
              </Link>
            )}
          </div>
        </div>

        <aside>
          <h2 className="mb-3 font-bold">محاضرات المادة</h2>
          <LectureList lectures={items} currentId={id} loggedIn />
        </aside>
      </div>
    </div>
  );
}

async function findSubjectForLecture(lectureId: string) {
  const [row] = await db
    .select({ subjectId: schema.lectures.subjectId })
    .from(schema.lectures)
    .where(eq(schema.lectures.id, lectureId));
  return row ? getSubjectDetail(row.subjectId) : null;
}
