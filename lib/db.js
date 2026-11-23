// نموذج البيانات وقواعد التحقق وعمليات التعديل.

import crypto from 'node:crypto';
import { HttpError } from './http.js';
import { backend } from './store.js';
import { SEED } from './seed.js';

export const DAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
export const KINDS = {
  subject: { field: 'subjects', label: 'المادة', ref: 'subjectId' },
  teacher: { field: 'teachers', label: 'المدرس', ref: 'teacherId' },
  group: { field: 'groups', label: 'الفئة', ref: 'groupId' },
  department: { field: 'departments', label: 'القسم', ref: 'departmentId' },
};
const YEAR_WITH_DEPARTMENTS = 4;

// ---------- أدوات ----------

export function normalizeArabic(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function newId() {
  return crypto.randomUUID();
}

function cleanName(name) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!n) throw new HttpError(400, 'الاسم لا يمكن أن يكون فارغًا.');
  if (n.length > 80) throw new HttpError(400, 'الاسم طويل جدًا.');
  return n;
}

function kindOf(kind) {
  const k = KINDS[kind];
  if (!k) throw new HttpError(400, 'نوع القائمة غير معروف.');
  return k;
}

function toMinutes(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function emptyDb() {
  return { subjects: [], teachers: [], groups: [], departments: [], lectures: [] };
}

// ---------- القراءة والكتابة ----------

async function load() {
  const store = backend();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { raw, version } = await store.read();
    if (raw != null) return { db: JSON.parse(raw), version };
    // أول تشغيل: نحفظ البيانات الأولى فورًا حتى تبقى المعرّفات ثابتة.
    const db = buildSeed();
    if (await store.compareAndSet(version, JSON.stringify(db), String(Number(version) + 1))) {
      return { db, version: String(Number(version) + 1) };
    }
  }
  throw new HttpError(503, 'تعذّر تجهيز قاعدة البيانات. حاول مجددًا.');
}

/// يطبّق تعديلًا على نسخة حديثة ويكتبها ذريًّا (يعيد المحاولة عند التزامن).
export async function mutate(fn) {
  const store = backend();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { db, version } = await load();
    const result = fn(db);
    db.updatedAt = new Date().toISOString();
    const next = String(Number(version) + 1);
    if (await store.compareAndSet(version, JSON.stringify(db), next)) return result;
  }
  throw new HttpError(409, 'حدث تعديل متزامن. حاول مجددًا.');
}

export async function publicSnapshot() {
  const { db } = await load();
  return toPublic(db);
}

/// الشكل الذي يقرؤه التطبيق (يطابق ScheduleSnapshot في Flutter).
export function toPublic(db) {
  const byId = (list) => new Map(list.map((x) => [x.id, x.name]));
  const subjects = byId(db.subjects);
  const teachers = byId(db.teachers);
  const groups = byId(db.groups);
  const departments = byId(db.departments);
  const sortByName = (list) =>
    [...list].map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return {
    fetchedAt: new Date().toISOString(),
    updatedAt: db.updatedAt ?? null,
    lectures: db.lectures.map((l) => ({
      id: l.id,
      day: l.day,
      start: l.start,
      end: l.end,
      year: l.year,
      subjectId: l.subjectId,
      subjectName: subjects.get(l.subjectId) ?? '—',
      teacherId: l.teacherId,
      teacherName: teachers.get(l.teacherId) ?? '—',
      groupId: l.groupId ?? null,
      groupName: l.groupId ? groups.get(l.groupId) ?? null : null,
      departmentId: l.departmentId ?? null,
      departmentName: l.departmentId ? departments.get(l.departmentId) ?? null : null,
      notes: l.notes ?? null,
    })),
    lookups: {
      subject: sortByName(db.subjects),
      teacher: sortByName(db.teachers),
      group: sortByName(db.groups),
      department: sortByName(db.departments),
    },
  };
}

// ---------- التحقق ----------

function findIn(list, id) {
  return list.find((x) => x.id === id);
}

export function validateLecture(db, input) {
  const day = String(input?.day ?? '').trim().toLowerCase();
  if (!DAYS.includes(day)) throw new HttpError(400, 'اليوم غير صالح.');

  const start = toMinutes(input.start);
  const end = toMinutes(input.end);
  const okTime = (t) => Number.isInteger(t) && t >= 0 && t < 24 * 60;
  if (!okTime(start) || !okTime(end)) throw new HttpError(400, 'الوقت غير صالح.');
  if (end <= start) throw new HttpError(400, 'وقت النهاية يجب أن يكون بعد وقت البداية.');

  const year = Number(input.year);
  if (![1, 2, 3, 4].includes(year)) throw new HttpError(400, 'السنة الدراسية غير صالحة.');

  if (!findIn(db.subjects, input.subjectId)) throw new HttpError(400, 'اختر المادة.');
  if (!findIn(db.teachers, input.teacherId)) throw new HttpError(400, 'اختر المدرس.');

  const groupId = input.groupId ?? null;
  if (groupId !== null && !findIn(db.groups, groupId)) throw new HttpError(400, 'الفئة غير موجودة.');

  const departmentId = input.departmentId ?? null;
  if (departmentId !== null) {
    if (year !== YEAR_WITH_DEPARTMENTS) throw new HttpError(400, 'القسم يُحدَّد للسنة الرابعة فقط.');
    if (!findIn(db.departments, departmentId)) throw new HttpError(400, 'القسم غير موجود.');
  }

  let notes = input.notes == null ? null : String(input.notes).trim();
  if (notes === '') notes = null;
  if (notes && notes.length > 200) throw new HttpError(400, 'الملاحظات طويلة جدًا.');

  return { day, start, end, year, subjectId: input.subjectId, teacherId: input.teacherId, groupId, departmentId, notes };
}

// ---------- العمليات ----------

export const ops = {
  saveLecture(db, input) {
    const clean = validateLecture(db, input);
    if (input.id) {
      const i = db.lectures.findIndex((l) => l.id === input.id);
      if (i < 0) throw new HttpError(404, 'المحاضرة غير موجودة. ربما حُذفت.');
      db.lectures[i] = { id: input.id, ...clean };
      return { id: input.id };
    }
    const id = newId();
    db.lectures.push({ id, ...clean });
    return { id };
  },

  deleteLecture(db, { id }) {
    const before = db.lectures.length;
    db.lectures = db.lectures.filter((l) => l.id !== id);
    if (db.lectures.length === before) throw new HttpError(404, 'المحاضرة غير موجودة.');
    return { ok: true };
  },

  addLookup(db, { kind, name }) {
    const k = kindOf(kind);
    const n = cleanName(name);
    if (db[k.field].some((x) => normalizeArabic(x.name) === normalizeArabic(n))) {
      throw new HttpError(409, 'هذا الاسم موجود مسبقًا.');
    }
    const item = { id: newId(), name: n };
    db[k.field].push(item);
    return { item };
  },

  renameLookup(db, { kind, id, name }) {
    const k = kindOf(kind);
    const n = cleanName(name);
    const item = findIn(db[k.field], id);
    if (!item) throw new HttpError(404, 'العنصر غير موجود.');
    if (db[k.field].some((x) => x.id !== id && normalizeArabic(x.name) === normalizeArabic(n))) {
      throw new HttpError(409, 'هذا الاسم موجود مسبقًا.');
    }
    item.name = n;
    return { ok: true };
  },

  deleteLookup(db, { kind, id }) {
    const k = kindOf(kind);
    if (!findIn(db[k.field], id)) throw new HttpError(404, 'العنصر غير موجود.');
    const used = db.lectures.filter((l) => l[k.ref] === id).length;
    if (used > 0) {
      throw new HttpError(
        409,
        `لا يمكن الحذف لأن ${k.label} مستخدم في ${used} من المحاضرات. عدّلها أو احذفها أولًا.`,
      );
    }
    db[k.field] = db[k.field].filter((x) => x.id !== id);
    return { ok: true };
  },
};

// ---------- البيانات الأولية ----------

function ensureByName(db, kind, name) {
  if (name == null || String(name).trim() === '') return null;
  const k = KINDS[kind];
  const n = cleanName(name);
  const found = db[k.field].find((x) => normalizeArabic(x.name) === normalizeArabic(n));
  if (found) return found.id;
  const item = { id: newId(), name: n };
  db[k.field].push(item);
  return item.id;
}

/// يبني قاعدة البيانات الأولى من ملف seed.js (أسماء بدل معرّفات).
export function buildSeed() {
  const db = emptyDb();
  for (const g of SEED.groups) ensureByName(db, 'group', g);
  for (const d of SEED.departments) ensureByName(db, 'department', d);
  for (const l of SEED.lectures) {
    const clean = validateLecture(db, {
      day: l.day,
      start: l.start,
      end: l.end,
      year: l.year,
      subjectId: ensureByName(db, 'subject', l.subject),
      teacherId: ensureByName(db, 'teacher', l.teacher),
      groupId: ensureByName(db, 'group', l.group),
      departmentId: ensureByName(db, 'department', l.department),
      notes: l.notes,
    });
    db.lectures.push({ id: newId(), ...clean });
  }
  db.updatedAt = null;
  return db;
}
