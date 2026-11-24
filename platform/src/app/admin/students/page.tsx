import Link from 'next/link';
import { count, desc, ilike, or, sql } from 'drizzle-orm';
import { AdminTitle, Empty } from '@/components/admin-ui';
import { db, schema } from '@/server/db';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'الطلاب' };
const PAGE = 50;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = '', page = '1' } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const term = q.trim().slice(0, 100);
  const u = schema.users;
  const where = term
    ? or(ilike(u.fullName, `%${term}%`), ilike(u.email, `%${term}%`), ilike(u.phone, `%${term.replace(/\s/g, '')}%`))
    : undefined;

  const activeCount = sql<number>`(select count(*) from enrollments e where e.user_id = ${u.id} and e.status = 'active' and (e.expires_at is null or e.expires_at > now()))`;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        active: activeCount,
      })
      .from(u)
      .where(where)
      .orderBy(desc(u.createdAt))
      .limit(PAGE)
      .offset((p - 1) * PAGE),
    db.select({ total: count() }).from(u).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total) / PAGE));

  return (
    <>
      <AdminTitle title="الطلاب" subtitle={`${Number(total)} حساب${term ? ' مطابق' : ''}`} />
      <form className="mb-5 flex gap-2" role="search">
        <input name="q" defaultValue={term} className="input" placeholder="ابحث بالاسم أو البريد أو الهاتف" aria-label="بحث" />
        <button className="btn-primary">بحث</button>
      </form>
      {rows.length === 0 ? (
        <Empty>{term ? 'لا نتائج.' : 'لم يسجّل أي طالب بعد.'}</Empty>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/students/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-paper">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{r.fullName}</span>
                    {r.role === 'admin' && <span className="badge-amber">مدير</span>}
                    {!r.isActive && <span className="badge-danger">موقوف</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                    <span dir="ltr">{r.email}</span>
                    <span dir="ltr">{r.phone}</span>
                  </span>
                </span>
                <span className="shrink-0 text-end text-xs text-ink-soft">
                  <span className={Number(r.active) > 0 ? 'badge-on' : 'badge-off'}>{Number(r.active)} اشتراك</span>
                  <span className="mt-1 block">{formatDate(r.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {p > 1 && <Link className="btn-ghost btn-sm" href={`?q=${encodeURIComponent(term)}&page=${p - 1}`}>السابق</Link>}
          <span>
            {p} / {pages}
          </span>
          {p < pages && <Link className="btn-ghost btn-sm" href={`?q=${encodeURIComponent(term)}&page=${p + 1}`}>التالي</Link>}
        </div>
      )}
    </>
  );
}
