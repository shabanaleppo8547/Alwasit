import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { AdminTitle, Empty, Panel } from '@/components/admin-ui';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { TargetSelect } from '@/components/target-select';
import { createCodeBatchAction } from '@/server/actions/admin-students';
import { db, schema } from '@/server/db';
import { getTargetOptions } from '@/server/queries';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'رموز التفعيل' };

export default async function CodesPage() {
  const b = schema.codeBatches;
  const [batches, options] = await Promise.all([
    db
      .select({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt,
        accessDays: b.accessDays,
        redeemBefore: b.redeemBefore,
        subjectTitle: schema.subjects.title,
        bundleTitle: schema.bundles.title,
        total: sql<number>`(select count(*) from activation_codes c where c.batch_id = ${b.id})`,
        used: sql<number>`(select count(*) from activation_codes c where c.batch_id = ${b.id} and c.uses_count > 0)`,
      })
      .from(b)
      .leftJoin(schema.subjects, eq(schema.subjects.id, b.subjectId))
      .leftJoin(schema.bundles, eq(schema.bundles.id, b.bundleId))
      .orderBy(desc(b.createdAt)),
    getTargetOptions(),
  ]);

  return (
    <>
      <AdminTitle
        title="رموز التفعيل"
        subtitle="أصدر دفعة رموز لمادة أو حزمة، ثم اطبعها أو أرسلها. كل رمز يُربط بحساب الطالب الذي يستخدمه أولًا."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          {batches.length === 0 ? (
            <Empty>لم تُصدر أي رموز بعد.</Empty>
          ) : (
            <ul className="card divide-y divide-line">
              {batches.map((x) => (
                <li key={x.id}>
                  <Link href={`/admin/codes/${x.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-paper">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{x.name}</span>
                      <span className="text-xs text-ink-soft">
                        {x.subjectTitle ?? `حزمة: ${x.bundleTitle}`} · {x.accessDays ? `${x.accessDays} يوم` : 'دائمة'} · {formatDate(x.createdAt)}
                      </span>
                    </span>
                    <span className="badge-off shrink-0">
                      <span className="ltr-nums">
                        {Number(x.used)}/{Number(x.total)}
                      </span>{' '}
                      مستخدم
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Panel title="إصدار دفعة جديدة" className="self-start">
          {options.length === 0 ? (
            <Empty>أضف مادة أولًا.</Empty>
          ) : (
            <ActionForm action={createCodeBatchAction} className="flex flex-col gap-3">
              <Field name="name" label="اسم الدفعة" placeholder="مثال: الجبر الخطي – الفصل الأول" />
              <TargetSelect options={options} />
              <div className="grid grid-cols-2 gap-3">
                <Field name="count" label="عدد الرموز" type="number" inputMode="numeric" defaultValue={10} />
                <Field name="maxUsesPerCode" label="طلاب لكل رمز" type="number" inputMode="numeric" defaultValue={1} />
              </div>
              <Field name="accessDays" label="مدة الصلاحية بعد التفعيل (أيام)" type="number" inputMode="numeric" placeholder="فارغ = دائمة" />
              <Field name="redeemBefore" label="آخر موعد لاستخدام الرموز (اختياري)" type="date" dir="ltr" />
              <SubmitButton>إصدار الرموز</SubmitButton>
            </ActionForm>
          )}
        </Panel>
      </div>
    </>
  );
}
