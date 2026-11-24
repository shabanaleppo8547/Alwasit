import Link from 'next/link';
import { AdminTitle, Empty } from '@/components/admin-ui';
import { getCatalog } from '@/server/queries';

export const metadata = { title: 'المواد' };

export default async function AdminSubjectsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const catalog = await getCatalog({ includeHidden: true });
  return (
    <>
      <AdminTitle
        title="المواد والمحاضرات"
        subtitle="اختر مادة لإدارة محاضراتها وحزمها."
        action={
          <Link href="/admin/subjects/new" className="btn-primary">
            + مادة جديدة
          </Link>
        }
      />
      {deleted && <p className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-deep">تم حذف المادة.</p>}
      {catalog.length === 0 && <Empty>لا توجد سنوات بعد.</Empty>}
      <div className="flex flex-col gap-8">
        {catalog.map((y) => (
          <section key={y.id}>
            <h2 className="mb-3 font-bold">
              {y.name} <span className="text-sm font-medium text-ink-soft">({y.subjects.length})</span>
            </h2>
            {y.subjects.length === 0 ? (
              <Empty>لا مواد في هذه السنة.</Empty>
            ) : (
              <ul className="card divide-y divide-line">
                {y.subjects.map((s) => {
                  const sec = y.sections.find((x) => x.id === s.sectionId);
                  return (
                    <li key={s.id}>
                      <Link href={`/admin/subjects/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-paper">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{s.title}</span>
                          <span className="text-xs text-ink-soft">
                            {s.teacherName ? `أ. ${s.teacherName}` : 'بلا أستاذ'}
                            {sec && ` · ${sec.name}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm text-ink-soft">{s.lectureCount} محاضرة ←</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
