'use client';

import { useState } from 'react';
import { ActionForm, Checkbox, Field, SelectField, SubmitButton } from './forms';
import type { ActionState } from '@/lib/action';

type Opt = { id: string; name: string };
type Sec = Opt & { yearId: string; kind: 'group' | 'department' };

export type SubjectFormValues = {
  id?: string;
  title?: string;
  yearId?: string;
  sectionId?: string | null;
  teacherId?: string | null;
  description?: string | null;
  priceNote?: string | null;
  sortOrder?: number;
  isPublished?: boolean;
};

export function SubjectForm({
  action,
  years,
  sections,
  teachers,
  values = {},
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  years: Opt[];
  sections: Sec[];
  teachers: Opt[];
  values?: SubjectFormValues;
}) {
  const [yearId, setYearId] = useState(values.yearId ?? years[0]?.id ?? '');
  const yearSections = sections.filter((s) => s.yearId === yearId);
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="sm:col-span-2">
        <Field name="title" label="اسم المادة" defaultValue={values.title} />
      </div>
      <SelectField name="yearId" label="السنة" value={yearId} onChange={(e) => setYearId(e.target.value)}>
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        key={yearId}
        name="sectionId"
        label="القسم / الفئة"
        defaultValue={yearSections.some((s) => s.id === values.sectionId) ? (values.sectionId ?? '') : ''}
        hint={yearSections.length ? undefined : 'لا أقسام لهذه السنة.'}
      >
        <option value="">مشتركة لكل السنة</option>
        {yearSections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.kind === 'group' ? 'الفئة' : 'قسم'} {s.name}
          </option>
        ))}
      </SelectField>
      <SelectField name="teacherId" label="المدرّس" defaultValue={values.teacherId ?? ''}>
        <option value="">— بلا أستاذ —</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </SelectField>
      <Field name="sortOrder" label="الترتيب" type="number" defaultValue={values.sortOrder ?? 0} />
      <div className="sm:col-span-2">
        <Field name="description" label="وصف المادة" textarea rows={4} defaultValue={values.description ?? ''} />
      </div>
      <div className="sm:col-span-2">
        <Field
          name="priceNote"
          label="ملاحظة الاشتراك (اختياري)"
          placeholder="مثال: الاشتراك لدى المركز أو عبر واتساب الأستاذ"
          defaultValue={values.priceNote ?? ''}
        />
      </div>
      <Checkbox name="isPublished" label="منشورة للطلاب" defaultChecked={values.isPublished ?? true} />
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary">{values.id ? 'حفظ التعديلات' : 'إنشاء المادة'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
