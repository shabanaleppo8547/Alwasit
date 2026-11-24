'use server';

// إدارة المحتوى: السنوات، الأقسام/الفئات، الأساتذة، المواد، المحاضرات، الحزم.
// كل إجراء يبدأ بـ requireAdmin() — التحقق على الخادم وليس بإخفاء الأزرار.

import { and, asc, eq, gt, lt, desc, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/lib/action';
import { parseDuration } from '@/lib/format';
import { requireAdmin } from '../auth/session';
import { db, schema } from '../db';
import type { TeacherContact } from '../db/schema';
import { validateVideoRef } from '../video';
import {
  checkbox,
  done,
  fail,
  handleError,
  intField,
  optionalText,
  optionalUuid,
  parseForm,
  trimmed,
  uuid,
} from './helpers';

function refreshAll() {
  revalidatePath('/', 'layout');
}

// ---------- السنوات ----------

const yearSchema = z.object({
  id: optionalUuid,
  name: trimmed(2, 60, 'اسم السنة'),
  description: optionalText(300),
  sortOrder: intField('الترتيب', 0, 1000),
  isPublished: checkbox,
});

export async function saveYearAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(yearSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { id, ...values } = parsed.data;
  try {
    if (id) await db.update(schema.years).set(values).where(eq(schema.years.id, id));
    else await db.insert(schema.years).values(values);
  } catch (err) {
    return handleError(err, 'حفظ السنة');
  }
  refreshAll();
  return done(id ? 'تم حفظ التعديلات.' : 'تمت إضافة السنة.');
}

export async function deleteYearAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    await db.delete(schema.years).where(eq(schema.years.id, id.data));
  } catch (err) {
    return handleError(err, 'حذف السنة');
  }
  refreshAll();
  return done('تم حذف السنة.');
}

// ---------- الأقسام والفئات ----------

const sectionSchema = z.object({
  id: optionalUuid,
  yearId: uuid,
  name: trimmed(1, 60, 'الاسم'),
  kind: z.enum(['group', 'department'], { error: 'اختر النوع.' }),
  sortOrder: intField('الترتيب', 0, 1000),
});

export async function saveSectionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(sectionSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { id, ...values } = parsed.data;
  try {
    if (id) await db.update(schema.sections).set(values).where(eq(schema.sections.id, id));
    else await db.insert(schema.sections).values(values);
  } catch (err) {
    return handleError(err, 'حفظ القسم');
  }
  refreshAll();
  return done(id ? 'تم حفظ التعديلات.' : 'تمت الإضافة.');
}

export async function deleteSectionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    await db.delete(schema.sections).where(eq(schema.sections.id, id.data));
  } catch (err) {
    return handleError(err, 'الحذف');
  }
  refreshAll();
  return done('تم الحذف.');
}

// ---------- الأساتذة ----------

const CONTACT_TYPES = ['whatsapp', 'telegram', 'facebook', 'phone', 'other'] as const;

/** كل سطر: "نوع: قيمة" مثل "whatsapp: 9639xxxxxxx". */
function parseContacts(text: string): TeacherContact[] | string {
  const out: TeacherContact[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const idx = line.indexOf(':');
    if (idx < 1) return `سطر غير مفهوم: "${line}". الصيغة: whatsapp: 9639xxxxxxx`;
    const type = line.slice(0, idx).trim().toLowerCase() as TeacherContact['type'];
    const value = line.slice(idx + 1).trim();
    if (!CONTACT_TYPES.includes(type)) return `نوع غير معروف: ${type}. الأنواع: ${CONTACT_TYPES.join(', ')}`;
    if (!value || value.length > 300) return `قيمة غير صالحة في السطر: "${line}"`;
    if (['telegram', 'facebook'].includes(type) && !/^https:\/\//.test(value)) {
      return `رابط ${type} يجب أن يبدأ بـ https://`;
    }
    out.push({ type, value });
  }
  return out.slice(0, 10);
}

const teacherSchema = z.object({
  id: optionalUuid,
  name: trimmed(2, 80, 'اسم الأستاذ'),
  title: optionalText(120),
  bio: optionalText(1000),
  contacts: z.string().max(3000).optional().default(''),
  sortOrder: intField('الترتيب', 0, 1000),
  isPublished: checkbox,
});

export async function saveTeacherAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(teacherSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { id, contacts: contactsText, ...rest } = parsed.data;
  const contacts = parseContacts(contactsText);
  if (typeof contacts === 'string') return fail(contacts, { contacts });
  try {
    if (id) await db.update(schema.teachers).set({ ...rest, contacts }).where(eq(schema.teachers.id, id));
    else await db.insert(schema.teachers).values({ ...rest, contacts });
  } catch (err) {
    return handleError(err, 'حفظ الأستاذ');
  }
  refreshAll();
  return done(id ? 'تم حفظ التعديلات.' : 'تمت إضافة الأستاذ.');
}

export async function deleteTeacherAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    await db.delete(schema.teachers).where(eq(schema.teachers.id, id.data));
  } catch (err) {
    return handleError(err, 'حذف الأستاذ');
  }
  refreshAll();
  return done('تم حذف الأستاذ، وأصبحت مواده بلا أستاذ محدد.');
}

// ---------- المواد ----------

const subjectSchema = z.object({
  id: optionalUuid,
  title: trimmed(2, 120, 'اسم المادة'),
  yearId: uuid,
  sectionId: optionalUuid,
  teacherId: optionalUuid,
  description: optionalText(2000),
  priceNote: optionalText(200),
  sortOrder: intField('الترتيب', 0, 1000),
  isPublished: checkbox,
});

export async function saveSubjectAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(subjectSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { id, ...values } = parsed.data;
  let newId: string | null = null;
  try {
    if (values.sectionId) {
      const [sec] = await db.select().from(schema.sections).where(eq(schema.sections.id, values.sectionId));
      if (!sec || sec.yearId !== values.yearId) {
        return fail('القسم/الفئة المختار لا يتبع السنة المختارة.', { sectionId: 'لا يتبع السنة.' });
      }
    }
    if (id) {
      await db.update(schema.subjects).set(values).where(eq(schema.subjects.id, id));
    } else {
      const [row] = await db.insert(schema.subjects).values(values).returning({ id: schema.subjects.id });
      newId = row.id;
    }
  } catch (err) {
    return handleError(err, 'حفظ المادة');
  }
  refreshAll();
  if (newId) redirect(`/admin/subjects/${newId}?created=1`);
  return done('تم حفظ المادة.');
}

export async function deleteSubjectAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    await db.delete(schema.subjects).where(eq(schema.subjects.id, id.data));
  } catch (err) {
    return handleError(err, 'حذف المادة');
  }
  refreshAll();
  redirect('/admin/subjects?deleted=1');
}

// ---------- المحاضرات ----------

const lectureSchema = z.object({
  id: optionalUuid,
  subjectId: uuid,
  title: trimmed(2, 160, 'عنوان المحاضرة'),
  description: optionalText(2000),
  duration: z.string().optional().default(''),
  videoRef: z.string().max(2000).optional().default(''),
  isFree: checkbox,
  isPublished: checkbox,
});

export async function saveLectureAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(lectureSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { id, subjectId, duration, videoRef, ...rest } = parsed.data;
  const durationSeconds = parseDuration(duration);
  if (Number.isNaN(durationSeconds)) return fail('صيغة المدة غير صحيحة. أمثلة: 45 أو 45:30 أو 1:20:00', { duration: 'صيغة غير صحيحة.' });
  const refError = validateVideoRef(videoRef);
  if (refError) return fail(refError, { videoRef: refError });
  const values = { ...rest, durationSeconds, videoRef: videoRef.trim() || null };
  try {
    if (id) {
      await db
        .update(schema.lectures)
        .set(values)
        .where(and(eq(schema.lectures.id, id), eq(schema.lectures.subjectId, subjectId)));
    } else {
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${schema.lectures.sortOrder}), 0)` })
        .from(schema.lectures)
        .where(eq(schema.lectures.subjectId, subjectId));
      await db.insert(schema.lectures).values({ ...values, subjectId, sortOrder: Number(max) + 1 });
    }
  } catch (err) {
    return handleError(err, 'حفظ المحاضرة');
  }
  refreshAll();
  return done(id ? 'تم حفظ المحاضرة.' : 'تمت إضافة المحاضرة في آخر القائمة.');
}

export async function deleteLectureAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    await db.delete(schema.lectures).where(eq(schema.lectures.id, id.data));
  } catch (err) {
    return handleError(err, 'حذف المحاضرة');
  }
  refreshAll();
  return done('تم حذف المحاضرة.');
}

/** تحريك محاضرة للأعلى أو للأسفل بتبديل ترتيبها مع جارتها. */
export async function moveLectureAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(z.object({ id: uuid, dir: z.enum(['up', 'down']) }), fd);
  if (!parsed.ok) return parsed.state;
  const { id, dir } = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(schema.lectures).where(eq(schema.lectures.id, id));
      if (!cur) return;
      const l = schema.lectures;
      const [neighbor] = await tx
        .select()
        .from(l)
        .where(and(eq(l.subjectId, cur.subjectId), dir === 'up' ? lt(l.sortOrder, cur.sortOrder) : gt(l.sortOrder, cur.sortOrder)))
        .orderBy(dir === 'up' ? desc(l.sortOrder) : asc(l.sortOrder))
        .limit(1);
      if (!neighbor) return;
      await tx.update(l).set({ sortOrder: neighbor.sortOrder }).where(eq(l.id, cur.id));
      await tx.update(l).set({ sortOrder: cur.sortOrder }).where(eq(l.id, neighbor.id));
    });
  } catch (err) {
    return handleError(err, 'تغيير الترتيب');
  }
  refreshAll();
  return done('تم تغيير الترتيب.');
}

// ---------- الحزم ----------

const bundleSchema = z.object({
  subjectId: uuid,
  title: trimmed(2, 120, 'اسم الحزمة'),
  description: optionalText(500),
  lectureIds: z.union([z.uuid(), z.array(z.uuid())], { error: 'اختر محاضرة واحدة على الأقل.' }).transform((v) => (Array.isArray(v) ? v : [v])),
});

export async function createBundleAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseForm(bundleSchema, fd);
  if (!parsed.ok) return parsed.state;
  const { subjectId, title, description, lectureIds } = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const valid = await tx
        .select({ id: schema.lectures.id })
        .from(schema.lectures)
        .where(and(eq(schema.lectures.subjectId, subjectId), inArray(schema.lectures.id, lectureIds)));
      if (!valid.length) throw new Error('no lectures');
      const [b] = await tx.insert(schema.bundles).values({ subjectId, title, description }).returning();
      await tx.insert(schema.bundleLectures).values(valid.map((v) => ({ bundleId: b.id, lectureId: v.id })));
    });
  } catch (err) {
    return handleError(err, 'إنشاء الحزمة');
  }
  refreshAll();
  return done('تم إنشاء الحزمة.');
}

export async function deleteBundleAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get('id'));
  if (!id.success) return fail('معرّف غير صالح.');
  try {
    await db.delete(schema.bundles).where(eq(schema.bundles.id, id.data));
  } catch (err) {
    return handleError(err, 'حذف الحزمة');
  }
  refreshAll();
  return done('تم حذف الحزمة واشتراكاتها.');
}
