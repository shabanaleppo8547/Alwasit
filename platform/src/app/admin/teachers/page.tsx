import { asc } from 'drizzle-orm';
import { AdminTitle, Empty, Panel } from '@/components/admin-ui';
import { ActionButton, ActionForm, Checkbox, Field, SubmitButton } from '@/components/forms';
import { deleteTeacherAction, saveTeacherAction } from '@/server/actions/admin-content';
import { db, schema } from '@/server/db';
import type { Teacher } from '@/server/db/schema';

export const metadata = { title: 'الأساتذة' };

const CONTACTS_HINT = 'سطر لكل وسيلة: whatsapp: 9639xxxxxxxx أو telegram: https://t.me/… أو facebook: https://… أو phone: 09…';

function TeacherFields({ t }: { t?: Teacher }) {
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <Field name="name" label="الاسم" defaultValue={t?.name} id={t?.id} />
      <Field name="title" label="الصفة (اختياري)" placeholder="مثال: مدرّس مواد التحليل" defaultValue={t?.title ?? ''} id={t?.id} />
      <Field name="bio" label="نبذة (اختياري)" textarea defaultValue={t?.bio ?? ''} id={t?.id} />
      <Field
        name="contacts"
        label="وسائل التواصل"
        textarea
        rows={3}
        dir="ltr"
        hint={CONTACTS_HINT}
        defaultValue={t?.contacts.map((c) => `${c.type}: ${c.value}`).join('\n') ?? ''}
        id={t?.id}
      />
      <Field name="sortOrder" label="الترتيب" type="number" defaultValue={t?.sortOrder ?? 0} id={t?.id} />
      <Checkbox name="isPublished" label="ظاهر في الصفحة الرئيسية" defaultChecked={t?.isPublished ?? true} />
    </>
  );
}

export default async function TeachersPage() {
  const teachers = await db.select().from(schema.teachers).orderBy(asc(schema.teachers.sortOrder), asc(schema.teachers.name));
  return (
    <>
      <AdminTitle title="الأساتذة" subtitle="يظهر الأساتذة المنشورون في الصفحة الرئيسية وفي صفحات موادهم." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {teachers.length === 0 && <Empty>لا يوجد أساتذة بعد.</Empty>}
          {teachers.map((t) => (
            <Panel key={t.id}>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="font-bold">أ. {t.name}</span>
                    {t.title && <span className="ms-2 text-sm text-ink-soft">{t.title}</span>}
                    {!t.isPublished && <span className="badge-danger ms-2">مخفي</span>}
                  </span>
                  <span className="btn-ghost btn-sm">تعديل</span>
                </summary>
                <ActionForm action={saveTeacherAction} className="mt-4 flex flex-col gap-3">
                  <TeacherFields t={t} />
                  <SubmitButton className="btn-primary self-start">حفظ</SubmitButton>
                </ActionForm>
                <div className="mt-3 border-t border-line pt-3">
                  <ActionButton action={deleteTeacherAction} fields={{ id: t.id }} className="btn-danger btn-sm" confirm={`حذف الأستاذ ${t.name}؟ ستبقى مواده بلا أستاذ.`}>
                    حذف
                  </ActionButton>
                </div>
              </details>
            </Panel>
          ))}
        </div>
        <Panel title="إضافة أستاذ" className="self-start">
          <ActionForm action={saveTeacherAction} resetOnSuccess className="flex flex-col gap-3">
            <TeacherFields />
            <SubmitButton>إضافة</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
