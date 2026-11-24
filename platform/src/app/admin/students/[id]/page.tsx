import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { AdminTitle, Empty, Panel } from '@/components/admin-ui';
import { ActionButton, ActionForm, Field, SubmitButton } from '@/components/forms';
import { TargetSelect } from '@/components/target-select';
import {
  adminResetLinkAction,
  grantEnrollmentAction,
  setEnrollmentStatusAction,
  setUserActiveAction,
  setUserRoleAction,
} from '@/server/actions/admin-students';
import { requireAdmin } from '@/server/auth/session';
import { db, schema } from '@/server/db';
import { getTargetOptions } from '@/server/queries';
import { formatDate, formatDateTime } from '@/lib/format';

export const metadata = { title: 'بيانات الطالب' };

const ACTIONS: Record<string, string> = {
  'user.register': 'إنشاء الحساب',
  'user.password_reset': 'تعيين كلمة مرور عبر رابط استعادة',
  'user.password_change': 'تغيير كلمة المرور',
  'user.reset_link': 'إنشاء رابط استعادة من الإدارة',
  'user.activate': 'تفعيل الحساب',
  'user.deactivate': 'إيقاف الحساب',
  'user.role': 'تغيير الدور',
  'enrollment.grant': 'تفعيل اشتراك من الإدارة',
  'enrollment.revoke': 'إلغاء صلاحية',
  'enrollment.restore': 'إعادة تفعيل صلاحية',
  'code.redeem': 'تفعيل برمز',
};

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = await requireAdmin();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!user) notFound();

  const e = schema.enrollments;
  const [enrollments, options, logs] = await Promise.all([
    db
      .select({
        id: e.id,
        status: e.status,
        source: e.source,
        activatedAt: e.activatedAt,
        expiresAt: e.expiresAt,
        note: e.note,
        subjectId: e.subjectId,
        subjectTitle: schema.subjects.title,
        bundleTitle: schema.bundles.title,
      })
      .from(e)
      .leftJoin(schema.bundles, eq(schema.bundles.id, e.bundleId))
      .leftJoin(schema.subjects, eq(schema.subjects.id, e.subjectId))
      .where(eq(e.userId, id))
      .orderBy(desc(e.activatedAt)),
    getTargetOptions(),
    db
      .select({ action: schema.auditLogs.action, createdAt: schema.auditLogs.createdAt, actorName: schema.users.fullName })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
      .where(eq(schema.auditLogs.targetUserId, id))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(30),
  ]);
  const now = new Date();
  const isSelf = admin.id === user.id;

  return (
    <>
      <AdminTitle
        title={user.fullName}
        subtitle={`${user.role === 'admin' ? 'مدير' : 'طالب'} · مسجّل منذ ${formatDate(user.createdAt)}`}
        action={
          <Link href="/admin/students" className="btn-ghost btn-sm">
            كل الطلاب
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Panel title={`الاشتراكات (${enrollments.length})`}>
            {enrollments.length === 0 ? (
              <Empty>لا اشتراكات لهذا الطالب بعد.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {enrollments.map((en) => {
                  const expired = en.expiresAt != null && en.expiresAt <= now;
                  const live = en.status === 'active' && !expired;
                  return (
                    <li key={en.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {en.subjectTitle ?? `حزمة: ${en.bundleTitle}`}
                          <span className={`ms-2 ${live ? 'badge-on' : en.status === 'revoked' ? 'badge-danger' : 'badge-off'}`}>
                            {live ? 'فعّال' : en.status === 'revoked' ? 'ملغى' : 'منتهي'}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                          {en.source === 'code' ? 'برمز تفعيل' : 'من الإدارة'} · منذ {formatDate(en.activatedAt)} ·{' '}
                          {en.expiresAt ? `ينتهي ${formatDate(en.expiresAt)}` : 'دائم'}
                          {en.note && ` · ${en.note}`}
                        </p>
                      </div>
                      {en.status === 'active' ? (
                        <ActionButton
                          action={setEnrollmentStatusAction}
                          fields={{ id: en.id, status: 'revoked' }}
                          className="btn-danger btn-sm"
                          confirm="إلغاء صلاحية هذه المادة للطالب؟"
                        >
                          إلغاء الصلاحية
                        </ActionButton>
                      ) : (
                        <ActionButton action={setEnrollmentStatusAction} fields={{ id: en.id, status: 'active' }} className="btn-ghost btn-sm">
                          إعادة التفعيل
                        </ActionButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="تفعيل مادة أو حزمة">
            {options.length === 0 ? (
              <Empty>لا مواد بعد.</Empty>
            ) : (
              <ActionForm action={grantEnrollmentAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="userId" value={user.id} />
                <div className="sm:col-span-2">
                  <TargetSelect options={options} />
                </div>
                <Field name="days" label="مدة الصلاحية بالأيام" type="number" inputMode="numeric" placeholder="فارغ = دائمة" hint="إن كان الاشتراك ساريًا تُضاف المدة إلى تاريخ انتهائه." />
                <Field name="note" label="ملاحظة (اختياري)" placeholder="مثال: دفع نقدًا" />
                <div className="sm:col-span-2">
                  <SubmitButton className="btn-primary">تفعيل للطالب</SubmitButton>
                </div>
              </ActionForm>
            )}
          </Panel>

          <Panel title="سجل النشاط">
            {logs.length === 0 ? (
              <Empty>لا نشاط مسجّل.</Empty>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {logs.map((l, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {ACTIONS[l.action] ?? l.action}
                      {l.actorName && <span className="text-ink-soft"> — {l.actorName}</span>}
                    </span>
                    <span className="text-xs text-ink-soft">{formatDateTime(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="بيانات الحساب">
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-ink-soft">البريد</dt>
                <dd className="font-semibold" dir="ltr">{user.email}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">الهاتف</dt>
                <dd className="font-semibold">
                  <a href={`https://wa.me/${user.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-brand hover:underline">
                    {user.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">آخر دخول</dt>
                <dd className="font-semibold">{formatDateTime(user.lastLoginAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">الحالة</dt>
                <dd>{user.isActive ? <span className="badge-on">نشط</span> : <span className="badge-danger">موقوف</span>}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="استعادة كلمة المرور">
            <p className="mb-3 text-sm leading-6 text-ink-soft">أنشئ رابطًا لمرة واحدة وأرسله للطالب عبر واتساب إن لم يصله البريد.</p>
            <ActionForm action={adminResetLinkAction}>
              <input type="hidden" name="id" value={user.id} />
              <SubmitButton className="btn-ghost w-full">إنشاء رابط استعادة</SubmitButton>
            </ActionForm>
          </Panel>

          {!isSelf && (
            <Panel title="صلاحيات الحساب">
              <div className="flex flex-col gap-2">
                <ActionButton
                  action={setUserActiveAction}
                  fields={{ id: user.id, active: user.isActive ? 'false' : 'true' }}
                  className={user.isActive ? 'btn-danger w-full' : 'btn-primary w-full'}
                  confirm={user.isActive ? 'إيقاف الحساب وتسجيل خروجه من كل الأجهزة؟' : undefined}
                >
                  {user.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                </ActionButton>
                <ActionButton
                  action={setUserRoleAction}
                  fields={{ id: user.id, role: user.role === 'admin' ? 'student' : 'admin' }}
                  className="btn-ghost w-full"
                  confirm={user.role === 'admin' ? 'إزالة صلاحية المدير؟' : 'منح هذا الحساب صلاحية المدير الكاملة؟'}
                >
                  {user.role === 'admin' ? 'إزالة صلاحية المدير' : 'جعله مديرًا'}
                </ActionButton>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
