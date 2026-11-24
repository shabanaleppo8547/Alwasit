import Link from 'next/link';
import { count, desc, eq, sql } from 'drizzle-orm';
import { AdminTitle, Panel } from '@/components/admin-ui';
import { db, schema } from '@/server/db';
import { formatDateTime } from '@/lib/format';

export default async function AdminHome() {
  const [[students], [subjects], [lectures], [enrolls], [redeemed], recent] = await Promise.all([
    db.select({ n: count() }).from(schema.users).where(eq(schema.users.role, 'student')),
    db.select({ n: count() }).from(schema.subjects),
    db.select({ n: count() }).from(schema.lectures),
    db
      .select({ n: count() })
      .from(schema.enrollments)
      .where(sql`${schema.enrollments.status} = 'active' and (${schema.enrollments.expiresAt} is null or ${schema.enrollments.expiresAt} > now())`),
    db.select({ n: count() }).from(schema.codeRedemptions),
    db
      .select({ id: schema.users.id, fullName: schema.users.fullName, email: schema.users.email, createdAt: schema.users.createdAt })
      .from(schema.users)
      .where(eq(schema.users.role, 'student'))
      .orderBy(desc(schema.users.createdAt))
      .limit(8),
  ]);
  const stats = [
    { label: 'طالب مسجّل', value: students.n, href: '/admin/students' },
    { label: 'اشتراك فعّال', value: enrolls.n, href: '/admin/students' },
    { label: 'مادة', value: subjects.n, href: '/admin/subjects' },
    { label: 'محاضرة', value: lectures.n, href: '/admin/subjects' },
    { label: 'رمز مُستخدم', value: redeemed.n, href: '/admin/codes' },
  ];
  return (
    <>
      <AdminTitle title="نظرة عامة" subtitle="ملخص المنصة الآن." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:border-brand/40">
            <p className="ltr-nums text-3xl font-bold">{Number(s.value)}</p>
            <p className="mt-1 text-sm text-ink-soft">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="أحدث الطلاب">
          {recent.length === 0 ? (
            <p className="text-sm text-ink-soft">لم يسجّل أي طالب بعد.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/students/${u.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{u.fullName}</span>
                      <span className="block truncate text-xs text-ink-soft" dir="ltr">
                        {u.email}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">{formatDateTime(u.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="إجراءات سريعة">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/admin/subjects/new" className="btn-primary">+ مادة جديدة</Link>
            <Link href="/admin/codes" className="btn-ghost">إصدار رموز تفعيل</Link>
            <Link href="/admin/students" className="btn-ghost">تفعيل مادة لطالب</Link>
            <Link href="/admin/structure" className="btn-ghost">السنوات والأقسام</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
