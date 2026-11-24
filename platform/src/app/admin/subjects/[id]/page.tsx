import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq, inArray } from 'drizzle-orm';
import { AdminTitle, Empty, Panel } from '@/components/admin-ui';
import { ActionButton, ActionForm, Checkbox, Field, SubmitButton } from '@/components/forms';
import { SubjectForm } from '@/components/subject-form';
import {
  createBundleAction,
  deleteBundleAction,
  deleteLectureAction,
  deleteSubjectAction,
  moveLectureAction,
  saveLectureAction,
  saveSubjectAction,
} from '@/server/actions/admin-content';
import { db, schema } from '@/server/db';
import type { Lecture } from '@/server/db/schema';
import { describeVideoRef } from '@/server/video';
import { formatDuration } from '@/lib/format';

export const metadata = { title: 'إدارة المادة' };

const VIDEO_HINT =
  'رابط https خاص بالفيديو (لا يظهر للطلاب، ويُبث عبر الخادم بعد التحقق من الاشتراك)، أو local:demo-1.mp4 للمحتوى التجريبي.';

function LectureFields({ l, subjectId }: { l?: Lecture; subjectId: string }) {
  return (
    <>
      <input type="hidden" name="subjectId" value={subjectId} />
      {l && <input type="hidden" name="id" value={l.id} />}
      <Field name="title" label="عنوان المحاضرة" defaultValue={l?.title} id={l?.id} />
      <Field name="description" label="وصف (اختياري)" textarea rows={2} defaultValue={l?.description ?? ''} id={l?.id} />
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field
          name="duration"
          label="المدة"
          placeholder="45:30"
          dir="ltr"
          defaultValue={l?.durationSeconds ? formatDuration(l.durationSeconds) ?? '' : ''}
          id={l?.id}
        />
        <Field name="videoRef" label="مصدر الفيديو" dir="ltr" defaultValue={l?.videoRef ?? ''} hint={VIDEO_HINT} id={l?.id} />
      </div>
      <div className="flex flex-wrap gap-5">
        <Checkbox name="isPublished" label="منشورة" defaultChecked={l?.isPublished ?? true} />
        <Checkbox name="isFree" label="مجانية (معاينة لكل طالب مسجّل)" defaultChecked={l?.isFree ?? false} />
      </div>
    </>
  );
}

export default async function AdminSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [subject] = await db.select().from(schema.subjects).where(eq(schema.subjects.id, id));
  if (!subject) notFound();

  const [years, sections, teachers, lectures, bundles] = await Promise.all([
    db.select({ id: schema.years.id, name: schema.years.name }).from(schema.years).orderBy(asc(schema.years.sortOrder)),
    db
      .select({ id: schema.sections.id, name: schema.sections.name, yearId: schema.sections.yearId, kind: schema.sections.kind })
      .from(schema.sections)
      .orderBy(asc(schema.sections.sortOrder)),
    db.select({ id: schema.teachers.id, name: schema.teachers.name }).from(schema.teachers).orderBy(asc(schema.teachers.sortOrder)),
    db.select().from(schema.lectures).where(eq(schema.lectures.subjectId, id)).orderBy(asc(schema.lectures.sortOrder), asc(schema.lectures.createdAt)),
    db.select().from(schema.bundles).where(eq(schema.bundles.subjectId, id)).orderBy(asc(schema.bundles.createdAt)),
  ]);
  const bundleLinks = bundles.length
    ? await db.select().from(schema.bundleLectures).where(inArray(schema.bundleLectures.bundleId, bundles.map((b) => b.id)))
    : [];

  return (
    <>
      <AdminTitle
        title={subject.title}
        subtitle={subject.isPublished ? 'منشورة للطلاب' : 'مخفية عن الطلاب'}
        action={
          <div className="flex gap-2">
            <Link href={`/subjects/${id}`} className="btn-ghost btn-sm">
              معاينة كطالب
            </Link>
            <Link href="/admin/subjects" className="btn-ghost btn-sm">
              كل المواد
            </Link>
          </div>
        }
      />
      {created && <p className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-deep">تم إنشاء المادة. أضف محاضراتها الآن.</p>}

      <div className="grid gap-6 2xl:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-6">
          <Panel title={`المحاضرات (${lectures.length})`}>
            {lectures.length === 0 ? (
              <Empty>لا محاضرات بعد. أضف أول محاضرة من النموذج أدناه.</Empty>
            ) : (
              <ol className="divide-y divide-line">
                {lectures.map((l, i) => {
                  const kind = describeVideoRef(l.videoRef);
                  return (
                    <li key={l.id} className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-sm font-bold ring-1 ring-line">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{l.title}</p>
                          <p className="flex flex-wrap gap-1.5 pt-1 text-xs text-ink-soft">
                            {formatDuration(l.durationSeconds) && <span className="ltr-nums">{formatDuration(l.durationSeconds)}</span>}
                            {l.isFree && <span className="badge-amber !py-0">مجانية</span>}
                            {!l.isPublished && <span className="badge-danger !py-0">مخفية</span>}
                            {kind === 'none' && <span className="badge-off !py-0">بلا فيديو</span>}
                            {kind === 'local' && <span className="badge-off !py-0">فيديو تجريبي</span>}
                            {kind === 'remote' && <span className="badge-on !py-0">فيديو خاص</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <ActionButton action={moveLectureAction} fields={{ id: l.id, dir: 'up' }} title="للأعلى">
                            ↑
                          </ActionButton>
                          <ActionButton action={moveLectureAction} fields={{ id: l.id, dir: 'down' }} title="للأسفل">
                            ↓
                          </ActionButton>
                        </div>
                      </div>
                      <details className="mt-2 ms-11">
                        <summary className="cursor-pointer text-sm font-semibold text-brand">تعديل</summary>
                        <ActionForm action={saveLectureAction} className="mt-3 flex flex-col gap-3">
                          <LectureFields l={l} subjectId={id} />
                          <div className="flex flex-wrap gap-2">
                            <SubmitButton className="btn-primary btn-sm">حفظ</SubmitButton>
                            <Link href={`/lectures/${l.id}`} className="btn-ghost btn-sm">
                              تشغيل
                            </Link>
                          </div>
                        </ActionForm>
                        <div className="mt-2">
                          <ActionButton action={deleteLectureAction} fields={{ id: l.id }} className="btn-danger btn-sm" confirm={`حذف المحاضرة "${l.title}"؟`}>
                            حذف المحاضرة
                          </ActionButton>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="إضافة محاضرة">
            <ActionForm action={saveLectureAction} resetOnSuccess className="flex flex-col gap-3">
              <LectureFields subjectId={id} />
              <SubmitButton className="btn-primary self-start">إضافة المحاضرة</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title="الحزم (بيع مجموعة محاضرات)">
            <p className="mb-4 text-sm leading-6 text-ink-soft">
              الحزمة مجموعة محاضرات من هذه المادة يمكن تفعيلها لطالب أو إصدار رموز لها، بدل تفعيل المادة كاملة.
            </p>
            {bundles.length > 0 && (
              <ul className="mb-5 flex flex-col gap-2">
                {bundles.map((b) => {
                  const ids = new Set(bundleLinks.filter((x) => x.bundleId === b.id).map((x) => x.lectureId));
                  return (
                    <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3 ring-1 ring-line">
                      <span>
                        <span className="font-semibold">{b.title}</span>
                        <span className="ms-2 text-xs text-ink-soft">{ids.size} محاضرة</span>
                      </span>
                      <ActionButton action={deleteBundleAction} fields={{ id: b.id }} className="btn-danger btn-sm" confirm="حذف الحزمة سيلغي اشتراكات الطلاب فيها. متابعة؟">
                        حذف
                      </ActionButton>
                    </li>
                  );
                })}
              </ul>
            )}
            {lectures.length === 0 ? (
              <Empty>أضف محاضرات أولًا.</Empty>
            ) : (
              <ActionForm action={createBundleAction} resetOnSuccess className="flex flex-col gap-3">
                <input type="hidden" name="subjectId" value={id} />
                <Field name="title" label="اسم الحزمة" placeholder="مثال: محاضرات الفصل الأول" id="bundle" />
                <fieldset className="rounded-xl border border-line p-3">
                  <legend className="px-1 text-sm font-semibold">المحاضرات</legend>
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                    {lectures.map((l, i) => (
                      <label key={l.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="lectureIds" value={l.id} className="h-4 w-4 accent-[var(--color-brand)]" />
                        {i + 1}. {l.title}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SubmitButton className="btn-ghost self-start">إنشاء الحزمة</SubmitButton>
              </ActionForm>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="بيانات المادة">
            <SubjectForm action={saveSubjectAction} years={years} sections={sections} teachers={teachers} values={subject} />
          </Panel>
          <Panel>
            <ActionButton
              action={deleteSubjectAction}
              fields={{ id }}
              className="btn-danger w-full"
              confirm="حذف المادة نهائيًا مع كل محاضراتها واشتراكات الطلاب فيها؟ لا يمكن التراجع."
            >
              حذف المادة نهائيًا
            </ActionButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
