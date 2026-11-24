import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LectureList } from '@/components/lecture-list';
import { getAccessSummary, lectureUnlocked } from '@/server/access';
import { getCurrentUser } from '@/server/auth/session';
import { getSubjectDetail, sectionLabel } from '@/server/queries';
import { daysLeft, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCurrentUser();
  const detail = await getSubjectDetail(id, { includeHidden: user?.role === 'admin' });
  if (!detail) notFound();
  const { subject, lectures } = detail;
  const access = user ? await getAccessSummary(user.id) : null;

  const fullAccess = user?.role === 'admin' || access?.subjects.has(subject.id);
  const expiresAt = access?.subjects.get(subject.id) ?? null;
  const partial = !fullAccess && lectures.some((l) => access?.lectureIds.has(l.id));
  const items = lectures.map((l) => ({ ...l, unlocked: lectureUnlocked(user, l, access) }));
  const firstUnlocked = items.find((l) => l.unlocked);
  const left = daysLeft(expiresAt);

  return (
    <div className="page py-8 sm:py-12">
      <nav className="mb-5 text-sm text-ink-soft" aria-label="مسار التنقل">
        <Link href={user ? '/dashboard' : '/#subjects'} className="hover:text-ink">
          {user ? 'لوحتي' : 'المواد'}
        </Link>
        <span className="mx-2">/</span>
        <span>{subject.yearName}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="animate-rise">
          <div className="flex flex-wrap gap-2">
            <span className="badge-off">{subject.yearName}</span>
            {subject.sectionName && <span className="badge-off">{sectionLabel(subject.sectionKind, subject.sectionName)}</span>}
            {!subject.isPublished && <span className="badge-danger">مخفية عن الطلاب</span>}
          </div>
          <h1 className="h-title mt-3">{subject.title}</h1>
          {subject.teacherName && (
            <p className="mt-2 text-ink-soft">
              المدرّس: <span className="font-semibold text-ink">أ. {subject.teacherName}</span>
              {subject.teacherTitle && <span> – {subject.teacherTitle}</span>}
            </p>
          )}
          {subject.description && <p className="mt-5 max-w-2xl leading-8 whitespace-pre-line text-ink-soft">{subject.description}</p>}

          <h2 className="mt-10 mb-3 text-lg font-bold">
            المحاضرات <span className="text-sm font-medium text-ink-soft">({lectures.length})</span>
          </h2>
          <LectureList lectures={items} loggedIn={Boolean(user)} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className={`p-6 ${fullAccess ? 'bg-brand text-white' : 'bg-ink text-white'}`}>
              <p className="text-sm text-white/70">حالة اشتراكك</p>
              <p className="mt-1 text-xl font-bold">
                {!user ? 'غير مسجّل الدخول' : fullAccess ? 'المادة مفعّلة ✓' : partial ? 'مفعّلة جزئيًا' : 'غير مفعّلة'}
              </p>
              {fullAccess && user?.role !== 'admin' && (
                <p className="mt-1 text-sm text-white/80">
                  {expiresAt ? (
                    <>
                      حتى {formatDate(expiresAt)}
                      {left != null && left <= 14 && <span className="ms-1 font-semibold text-amber">(باقي {left} يوم)</span>}
                    </>
                  ) : (
                    'صلاحية دائمة'
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 p-6">
              {!user ? (
                <>
                  <p className="text-sm leading-6 text-ink-soft">سجّل الدخول أو أنشئ حسابًا لتفعيل المادة ومشاهدة المحاضرات.</p>
                  <Link href={`/register?next=/subjects/${subject.id}`} className="btn-primary">
                    إنشاء حساب
                  </Link>
                  <Link href={`/login?next=/subjects/${subject.id}`} className="btn-ghost">
                    تسجيل الدخول
                  </Link>
                </>
              ) : fullAccess ? (
                firstUnlocked ? (
                  <Link href={`/lectures/${firstUnlocked.id}`} className="btn-primary">
                    ابدأ المشاهدة ▶
                  </Link>
                ) : (
                  <p className="text-sm text-ink-soft">ستظهر المحاضرات هنا فور إضافتها.</p>
                )
              ) : (
                <>
                  <p className="text-sm leading-6 text-ink-soft">
                    {subject.priceNote ?? 'للاشتراك تواصل مع مركز الوسيط، وستحصل على رمز تفعيل لهذه المادة.'}
                  </p>
                  <Link href="/redeem" className="btn-primary">
                    لدي رمز تفعيل
                  </Link>
                  {firstUnlocked && (
                    <Link href={`/lectures/${firstUnlocked.id}`} className="btn-ghost">
                      شاهد المحاضرة المجانية
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
