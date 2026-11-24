import Link from 'next/link';
import type { Metadata } from 'next';
import { CatalogBrowser } from '@/components/catalog-browser';
import { getAccessSummary } from '@/server/access';
import { requireUser } from '@/server/auth/session';
import { getCatalog } from '@/server/queries';
import { daysLeft, formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'لوحتي' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const { welcome, denied } = await searchParams;
  const user = await requireUser('/dashboard');
  const [catalog, access] = await Promise.all([getCatalog(), getAccessSummary(user.id)]);

  const statuses: Record<string, 'active' | 'partial' | 'none'> = {};
  const all = catalog.flatMap((y) => y.subjects.map((s) => ({ ...s, yearName: y.name })));
  for (const s of all) {
    statuses[s.id] =
      user.role === 'admin' || access.subjects.has(s.id) ? 'active' : access.partialSubjectIds.has(s.id) ? 'partial' : 'none';
  }
  const mine = all.filter((s) => statuses[s.id] !== 'none' && (user.role !== 'admin' || access.subjects.has(s.id)));

  return (
    <div className="page py-8 sm:py-12">
      {denied && (
        <p role="alert" className="mb-5 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          لوحة الإدارة متاحة للمدير فقط.
        </p>
      )}
      {welcome && (
        <p role="status" className="mb-5 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-deep">
          تم إنشاء حسابك بنجاح. أهلًا بك في مركز الوسيط!
        </p>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div className="math-grid absolute inset-0" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-white/60">مرحبًا،</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{user.fullName}</h1>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
              <span dir="ltr">{user.email}</span>
              <span dir="ltr">{user.phone}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/redeem" className="btn-amber btn-sm">
              إدخال رمز تفعيل
            </Link>
            <Link href="/account" className="btn btn-sm border border-white/25 text-white hover:bg-white/10">
              حسابي
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold">
          موادي المفعّلة <span className="text-sm font-medium text-ink-soft">({mine.length})</span>
        </h2>
        {mine.length === 0 ? (
          <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">لا توجد مواد مفعّلة على حسابك بعد.</p>
              <p className="mt-1 text-sm text-ink-soft">بعد الاشتراك لدى المركز أدخل رمز التفعيل، أو انتظر تفعيل الإدارة لحسابك.</p>
            </div>
            <Link href="/redeem" className="btn-primary btn-sm">
              إدخال رمز
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((s) => {
              const exp = access.subjects.get(s.id) ?? null;
              const left = daysLeft(exp);
              return (
                <li key={s.id}>
                  <Link href={`/subjects/${s.id}`} className="card flex h-full flex-col gap-2 border-brand/30 p-5 transition hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold">{s.title}</h3>
                      <span className={statuses[s.id] === 'active' ? 'badge-on' : 'badge-amber'}>
                        {statuses[s.id] === 'active' ? 'مفعّلة' : 'جزئية'}
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft">
                      {s.yearName}
                      {s.teacherName && <> · أ. {s.teacherName}</>}
                    </p>
                    <p className="mt-auto pt-2 text-xs text-ink-soft">
                      {s.lectureCount} محاضرة ·{' '}
                      {statuses[s.id] === 'partial'
                        ? 'محاضرات محددة'
                        : exp
                          ? <>حتى {formatDate(exp)}{left != null && left <= 14 && <span className="font-semibold text-[#8a5a10]"> (باقي {left} يوم)</span>}</>
                          : 'صلاحية دائمة'}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-bold">كل السنوات والمواد</h2>
        <CatalogBrowser years={catalog} statuses={statuses} />
      </section>
    </div>
  );
}
