import { asc } from 'drizzle-orm';
import { AdminTitle, Panel } from '@/components/admin-ui';
import { ActionButton, ActionForm, Checkbox, Field, SelectField, SubmitButton } from '@/components/forms';
import { deleteSectionAction, deleteYearAction, saveSectionAction, saveYearAction } from '@/server/actions/admin-content';
import { db, schema } from '@/server/db';

export const metadata = { title: 'السنوات والأقسام' };

export default async function StructurePage() {
  const [years, sections, subjects] = await Promise.all([
    db.select().from(schema.years).orderBy(asc(schema.years.sortOrder)),
    db.select().from(schema.sections).orderBy(asc(schema.sections.sortOrder)),
    db.select({ yearId: schema.subjects.yearId, sectionId: schema.subjects.sectionId }).from(schema.subjects),
  ]);
  return (
    <>
      <AdminTitle
        title="السنوات والأقسام والفئات"
        subtitle="الفئة (مثل A وB) تقسيم للطلاب داخل السنة، والقسم (مثل الجبر) تخصص. كلاهما اختياري لكل سنة."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {years.map((y) => {
            const ys = sections.filter((s) => s.yearId === y.id);
            const subjectCount = subjects.filter((s) => s.yearId === y.id).length;
            return (
              <Panel key={y.id}>
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span>
                      <span className="text-lg font-bold">{y.name}</span>
                      <span className="ms-2 text-sm text-ink-soft">{subjectCount} مادة</span>
                      {!y.isPublished && <span className="badge-danger ms-2">مخفية</span>}
                    </span>
                    <span className="btn-ghost btn-sm">تعديل</span>
                  </summary>
                  <ActionForm action={saveYearAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={y.id} />
                    <Field name="name" label="اسم السنة" defaultValue={y.name} id={y.id} />
                    <Field name="sortOrder" label="الترتيب" type="number" defaultValue={y.sortOrder} id={y.id} />
                    <div className="sm:col-span-2">
                      <Field name="description" label="وصف (اختياري)" defaultValue={y.description ?? ''} id={y.id} />
                    </div>
                    <Checkbox name="isPublished" label="ظاهرة للطلاب" defaultChecked={y.isPublished} />
                    <div className="flex gap-2 sm:col-span-2">
                      <SubmitButton className="btn-primary btn-sm">حفظ</SubmitButton>
                    </div>
                  </ActionForm>
                  <div className="mt-3 border-t border-line pt-3">
                    <ActionButton
                      action={deleteYearAction}
                      fields={{ id: y.id }}
                      className="btn-danger btn-sm"
                      confirm={`حذف "${y.name}"؟ لا يمكن الحذف إن كانت فيها مواد أو أقسام.`}
                    >
                      حذف السنة
                    </ActionButton>
                  </div>
                </details>

                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-sm font-semibold text-ink-soft">الأقسام والفئات</p>
                  {ys.length === 0 ? (
                    <p className="text-sm text-ink-soft">لا يوجد — كل المواد مشتركة لكل طلاب السنة.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {ys.map((s) => (
                        <li key={s.id} className="flex items-center gap-1 rounded-xl bg-paper py-1 ps-3 pe-1 ring-1 ring-line">
                          <span className="text-sm font-semibold">{s.name}</span>
                          <span className="text-xs text-ink-soft">({s.kind === 'group' ? 'فئة' : 'قسم'})</span>
                          <ActionButton
                            action={deleteSectionAction}
                            fields={{ id: s.id }}
                            className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger-soft"
                            confirm={`حذف "${s.name}"؟`}
                          >
                            ✕
                          </ActionButton>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ActionForm action={saveSectionAction} resetOnSuccess className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="yearId" value={y.id} />
                    <input type="hidden" name="sortOrder" value={ys.length + 1} />
                    <div className="min-w-32 flex-1">
                      <Field name="name" label="إضافة" placeholder="مثال: A أو الجبر" id={`sec-${y.id}`} />
                    </div>
                    <div className="w-32">
                      <SelectField name="kind" label="النوع" id={`kind-${y.id}`}>
                        <option value="group">فئة</option>
                        <option value="department">قسم</option>
                      </SelectField>
                    </div>
                    <SubmitButton className="btn-ghost">إضافة</SubmitButton>
                  </ActionForm>
                </div>
              </Panel>
            );
          })}
        </div>
        <Panel title="إضافة سنة" className="self-start">
          <ActionForm action={saveYearAction} resetOnSuccess className="flex flex-col gap-3">
            <Field name="name" label="اسم السنة" placeholder="مثال: السنة الخامسة" />
            <Field name="sortOrder" label="الترتيب" type="number" defaultValue={years.length + 1} />
            <Field name="description" label="وصف (اختياري)" />
            <Checkbox name="isPublished" label="ظاهرة للطلاب" defaultChecked />
            <SubmitButton>إضافة السنة</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
