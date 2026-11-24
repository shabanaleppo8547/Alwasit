import Link from 'next/link';
import { and, count, desc, eq, like } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AdminTitle, Empty, Panel } from '@/components/admin-ui';
import { DeviceRequestActions } from '@/components/device-request-actions';
import { db, schema } from '@/server/db';
import { DEVICE_EVENTS } from '@/lib/device-events';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'الأجهزة' };

export default async function DevicesPage() {
  const r = schema.deviceRequests;
  const actor = alias(schema.users, 'actor');
  const target = alias(schema.users, 'target');
  const [pending, events, [{ active }]] = await Promise.all([
    db
      .select({
        id: r.id,
        label: r.label,
        ip: r.ip,
        createdAt: r.createdAt,
        userId: r.userId,
        name: schema.users.fullName,
        email: schema.users.email,
        currentLabel: schema.devices.label,
        currentSeen: schema.devices.lastSeenAt,
      })
      .from(r)
      .innerJoin(schema.users, eq(schema.users.id, r.userId))
      .leftJoin(schema.devices, and(eq(schema.devices.userId, r.userId), eq(schema.devices.status, 'active')))
      .where(eq(r.status, 'pending'))
      .orderBy(r.createdAt),
    db
      .select({
        action: schema.auditLogs.action,
        createdAt: schema.auditLogs.createdAt,
        details: schema.auditLogs.details,
        actorName: actor.fullName,
        targetName: target.fullName,
        targetId: target.id,
      })
      .from(schema.auditLogs)
      .leftJoin(actor, eq(actor.id, schema.auditLogs.actorId))
      .leftJoin(target, eq(target.id, schema.auditLogs.targetUserId))
      .where(like(schema.auditLogs.action, 'device.%'))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100),
    db.select({ active: count() }).from(schema.devices).where(eq(schema.devices.status, 'active')),
  ]);

  return (
    <>
      <AdminTitle
        title="الأجهزة وطلبات النقل"
        subtitle={`كل حساب طالب مرتبط بجهاز واحد. الأجهزة المعتمدة حاليًا: ${Number(active)}.`}
      />
      <Panel title={`طلبات نقل معلّقة (${pending.length})`}>
        {pending.length === 0 ? (
          <Empty>لا توجد طلبات معلّقة.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_260px]">
                <div className="text-sm">
                  <Link href={`/admin/students/${p.userId}`} className="font-bold text-brand hover:underline">
                    {p.name}
                  </Link>
                  <span className="ms-2 text-xs text-ink-soft" dir="ltr">
                    {p.email}
                  </span>
                  <p className="mt-2">
                    <span className="text-ink-soft">الجهاز الجديد: </span>
                    <span className="font-semibold">{p.label}</span>
                    <span className="block text-xs text-ink-soft">
                      طُلب في <bdi>{formatDateTime(p.createdAt)}</bdi>
                      {p.ip && (
                        <>
                          {' · IP '}
                          <bdi dir="ltr">{p.ip}</bdi>
                        </>
                      )}
                    </span>
                  </p>
                  <p className="mt-1">
                    <span className="text-ink-soft">الجهاز الحالي: </span>
                    {p.currentLabel ? (
                      <>
                        <span className="font-semibold">{p.currentLabel}</span>
                        <span className="block text-xs text-ink-soft">
                          آخر نشاط <bdi>{formatDateTime(p.currentSeen)}</bdi>
                        </span>
                      </>
                    ) : (
                      'لا يوجد'
                    )}
                  </p>
                </div>
                <DeviceRequestActions id={p.id} studentName={p.name} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="سجل عمليات الأجهزة" className="mt-6">
        {events.length === 0 ? (
          <Empty>لا عمليات بعد.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span>
                  <span className={e.action === 'device.login_rejected' ? 'font-semibold text-danger' : 'font-semibold'}>
                    {DEVICE_EVENTS[e.action] ?? e.action}
                  </span>
                  {e.targetId && (
                    <>
                      {' — '}
                      <Link href={`/admin/students/${e.targetId}`} className="text-brand hover:underline">
                        {e.targetName}
                      </Link>
                    </>
                  )}
                  {typeof e.details?.label === 'string' && <span className="text-ink-soft"> · {e.details.label}</span>}
                  {typeof e.details?.newLabel === 'string' && <span className="text-ink-soft"> · {e.details.newLabel}</span>}
                  {e.actorName && e.actorName !== e.targetName && <span className="text-ink-soft"> · بواسطة {e.actorName}</span>}
                </span>
                <span className="text-xs text-ink-soft">{formatDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
