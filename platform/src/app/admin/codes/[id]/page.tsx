import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { AdminTitle, Panel } from '@/components/admin-ui';
import { ActionButton } from '@/components/forms';
import { PrintButton } from '@/components/print-button';
import { deleteCodeBatchAction, toggleCodeAction } from '@/server/actions/admin-students';
import { db, schema } from '@/server/db';
import { appUrl } from '@/server/request';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'دفعة رموز' };

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = schema.codeBatches;
  const [batch] = await db
    .select({
      id: b.id,
      name: b.name,
      maxUsesPerCode: b.maxUsesPerCode,
      accessDays: b.accessDays,
      redeemBefore: b.redeemBefore,
      subjectTitle: schema.subjects.title,
      bundleTitle: schema.bundles.title,
    })
    .from(b)
    .leftJoin(schema.subjects, eq(schema.subjects.id, b.subjectId))
    .leftJoin(schema.bundles, eq(schema.bundles.id, b.bundleId))
    .where(eq(b.id, id));
  if (!batch) notFound();

  const codes = await db
    .select()
    .from(schema.activationCodes)
    .where(eq(schema.activationCodes.batchId, id))
    .orderBy(asc(schema.activationCodes.createdAt), asc(schema.activationCodes.code));
  const redemptions = await db
    .select({ codeId: schema.codeRedemptions.codeId, userId: schema.users.id, name: schema.users.fullName })
    .from(schema.codeRedemptions)
    .innerJoin(schema.activationCodes, eq(schema.activationCodes.id, schema.codeRedemptions.codeId))
    .innerJoin(schema.users, eq(schema.users.id, schema.codeRedemptions.userId))
    .where(eq(schema.activationCodes.batchId, id));

  const base = appUrl();
  const qrs = await Promise.all(
    codes.map((c) =>
      QRCode.toString(`${base}/redeem?code=${c.code}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0d1b2a', light: '#ffffff' } }),
    ),
  );
  const target = batch.subjectTitle ?? `حزمة: ${batch.bundleTitle}`;

  return (
    <>
      <div className="print:hidden">
        <AdminTitle
          title={batch.name}
          subtitle={`${target} · ${batch.accessDays ? `صلاحية ${batch.accessDays} يوم` : 'صلاحية دائمة'} · ${batch.maxUsesPerCode} طالب لكل رمز${
            batch.redeemBefore ? ` · يُستخدم قبل ${formatDate(batch.redeemBefore)}` : ''
          }`}
          action={
            <div className="flex gap-2">
              <PrintButton />
              <Link href="/admin/codes" className="btn-ghost btn-sm">
                كل الدفعات
              </Link>
            </div>
          }
        />
      </div>

      <Panel className="print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-soft">
              <tr className="text-start">
                <th className="py-2 text-start font-semibold">الرمز</th>
                <th className="py-2 text-start font-semibold">الاستخدام</th>
                <th className="py-2 text-start font-semibold">استخدمه</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {codes.map((c) => {
                const users = redemptions.filter((r) => r.codeId === c.id);
                return (
                  <tr key={c.id}>
                    <td className="py-2.5 font-mono font-semibold whitespace-nowrap" dir="ltr">
                      {c.code}
                    </td>
                    <td className="py-2.5">
                      {c.isDisabled ? (
                        <span className="badge-danger">معطّل</span>
                      ) : (
                        <span className={c.usesCount >= batch.maxUsesPerCode ? 'badge-off' : 'badge-on'}>
                          <span className="ltr-nums">
                            {c.usesCount}/{batch.maxUsesPerCode}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {users.map((u) => (
                        <Link key={u.userId} href={`/admin/students/${u.userId}`} className="me-2 text-brand hover:underline">
                          {u.name}
                        </Link>
                      ))}
                    </td>
                    <td className="py-2.5 text-end">
                      <ActionButton action={toggleCodeAction} fields={{ id: c.id, disabled: c.isDisabled ? 'false' : 'true' }}>
                        {c.isDisabled ? 'تفعيل' : 'تعطيل'}
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <ActionButton
            action={deleteCodeBatchAction}
            fields={{ id }}
            className="btn-danger btn-sm"
            confirm="حذف الدفعة وكل رموزها؟ الاشتراكات التي فُعّلت سابقًا تبقى."
          >
            حذف الدفعة
          </ActionButton>
        </div>
      </Panel>

      {/* بطاقات قابلة للطباعة */}
      <h2 className="mt-8 mb-3 font-bold print:hidden">بطاقات الطباعة</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-3 print:gap-2">
        {codes
          .filter((c) => !c.isDisabled)
          .map((c, i) => (
            <div key={c.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border border-dashed border-ink/30 bg-white p-3 text-center">
              <p className="text-xs font-bold">مركز الوسيط</p>
              <p className="line-clamp-2 text-[11px] text-ink-soft">{target}</p>
              <div className="w-28" dangerouslySetInnerHTML={{ __html: qrs[codes.indexOf(c)] }} />
              <p className="font-mono text-[11px] font-bold" dir="ltr">
                {c.code}
              </p>
              <p className="text-[10px] text-ink-soft">امسح الرمز أو أدخله في صفحة التفعيل</p>
              <span className="sr-only">{i}</span>
            </div>
          ))}
      </div>
    </>
  );
}
