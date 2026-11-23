// نموذج البيانات وقواعد التحقق وعمليات التعديل.
//
// db = {
//   groups:      [{ id, name }]                       الفئات (A، B)
//   departments: [{ id, name }]                       أقسام السنة الرابعة
//   teachers:    [{ id, name, contacts: [{ id, type, value, label }] }]
//   subjects:    [{ id, name, year, departmentId, teacherId,
//                   channels: [{ id, groupId, url, enabled }] }]
//   lectures:    [{ id, day, start, end, subjectId, groupId, notes }]
// }
// السنة والأستاذ والقسم تُستمد من المادة، فلا يمكن أن تختلف بين الأقسام.

import crypto from 'node:crypto';
import { HttpError } from './http.js';
import { backend } from './store.js';
import { SEED } from './seed.js';

export const DAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
export const YEARS = [1, 2, 3, 4];
const YEAR_WITH_DEPARTMENTS = 4;
/** السنوات التي يُسمح فيها بالفئات (لا فئات في الثالثة ولا الرابعة). */
const YEARS_WITH_GROUPS = [1, 2];
const CONTACT_TYPES = ['whatsapp', 'telegram', 'facebook', 'phone', 'other'];
const LOOKUPS = {
  group: { field: 'groups', label: 'الفئة' },
  department: { field: 'departments', label: 'القسم' },
};

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

const newId = () => crypto.randomUUID();
const same = (a, b) => normalizeArabic(a) === normalizeArabic(b);
const findIn = (list, id) => list.find((x) => x.id === id);

function cleanName(name, max = 80) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!n) throw new HttpError(400, 'الاسم لا يمكن أن يكون فارغًا.');
  if (n.length > max) throw new HttpError(400, 'الاسم طويل جدًا.');
  return n;
}

function toMinutes(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function nullableId(v) {
  return v === undefined || v === null || v === '' ? null : String(v);
}

export function emptyDb() {
  return { schema: 2, groups: [], departments: [], teachers: [], subjects: [], lectures: [] };
}

// ---------- القراءة والكتابة ----------

async function load() {
  const store = backend();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { raw, version } = await store.read();
    if (raw != null) {
      const db = JSON.parse(raw);
      if (db.schema === 2) return { db, version };
      // نسخة قديمة تجريبية (قبل البيانات الرسمية): تُستبدل بالبيانات الرسمية.
    }
    const db = buildSeed();
    const next = String(Number(version) + 1);
    if (await store.compareAndSet(version, JSON.stringify(db), next)) return { db, version: next };
  }
  throw new HttpError(503, 'تعذّر تجهيز قاعدة البيانات. حاول مجددًا.');
}

/** يطبّق تعديلًا على أحدث نسخة ويكتبها ذريًّا (يعيد المحاولة عند التزامن). */
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

/** الشكل الذي يقرؤه التطبيق (يطابق ScheduleSnapshot في Flutter). */
export function toPublic(db) {
  const nameMap = (list) => new Map(list.map((x) => [x.id, x.name]));
  const groups = nameMap(db.groups);
  const departments = nameMap(db.departments);
  const teachers = nameMap(db.teachers);
  const subjects = new Map(db.subjects.map((s) => [s.id, s]));
  const byName = (a, b) => a.name.localeCompare(b.name, 'ar');

  return {
    fetchedAt: new Date().toISOString(),
    updatedAt: db.updatedAt ?? null,
    groups: db.groups.map(({ id, name }) => ({ id, name })).sort(byName),
    departments: db.departments.map(({ id, name }) => ({ id, name })),
    teachers: db.teachers.map((t) => ({
      id: t.id,
      name: t.name,
      contacts: t.contacts.map((c) => ({ id: c.id, type: c.type, value: c.value, label: c.label ?? null })),
    })),
    subjects: db.subjects
      .map((s) => ({
        id: s.id,
        name: s.name,
        year: s.year,
        departmentId: s.departmentId ?? null,
        departmentName: s.departmentId ? departments.get(s.departmentId) ?? null : null,
        teacherId: s.teacherId,
        teacherName: teachers.get(s.teacherId) ?? '—',
        channels: (s.channels ?? []).map((c) => ({
          id: c.id,
          groupId: c.groupId ?? null,
          groupName: c.groupId ? groups.get(c.groupId) ?? null : null,
          url: c.url ?? '',
          enabled: c.enabled !== false,
        })),
      }))
      .sort((a, b) => a.year - b.year || byName(a, b)),
    lectures: db.lectures.map((l) => {
      const s = subjects.get(l.subjectId);
      return {
        id: l.id,
        day: l.day,
        start: l.start,
        end: l.end,
        year: s?.year ?? 0,
        subjectId: l.subjectId,
        subjectName: s?.name ?? '—',
        teacherId: s?.teacherId ?? '',
        teacherName: s ? teachers.get(s.teacherId) ?? '—' : '—',
        groupId: l.groupId ?? null,
        groupName: l.groupId ? groups.get(l.groupId) ?? null : null,
        departmentId: s?.departmentId ?? null,
        departmentName: s?.departmentId ? departments.get(s.departmentId) ?? null : null,
        notes: l.notes ?? null,
      };
    }),
  };
}

// ---------- التحقق ----------

function validateUrl(value, { telegram = false } = {}) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new HttpError(400, 'الرابط غير صالح. يجب أن يبدأ بـ https://');
  }
  if (telegram) {
    const ok =
      (u.protocol === 'https:' && ['t.me', 'telegram.me', 'www.t.me'].includes(u.hostname)) ||
      u.protocol === 'tg:';
    if (!ok) throw new HttpError(400, 'رابط تيليغرام يجب أن يبدأ بـ https://t.me/');
  } else if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new HttpError(400, 'الرابط يجب أن يبدأ بـ https://');
  }
  if (v.length > 300) throw new HttpError(400, 'الرابط طويل جدًا.');
  return v;
}

function validateLecture(db, input) {
  const day = String(input?.day ?? '').trim().toLowerCase();
  if (!DAYS.includes(day)) throw new HttpError(400, 'اليوم غير صالح.');
  const start = toMinutes(input.start);
  const end = toMinutes(input.end);
  const okTime = (t) => Number.isInteger(t) && t >= 0 && t < 24 * 60;
  if (!okTime(start) || !okTime(end)) throw new HttpError(400, 'الوقت غير صالح.');
  if (end <= start) throw new HttpError(400, 'وقت النهاية يجب أن يكون بعد وقت البداية.');

  const subject = findIn(db.subjects, input.subjectId);
  if (!subject) throw new HttpError(400, 'اختر المادة.');

  const groupId = nullableId(input.groupId);
  if (groupId !== null) {
    if (!YEARS_WITH_GROUPS.includes(subject.year)) {
      throw new HttpError(400, 'لا توجد فئات في هذه السنة.');
    }
    if (!findIn(db.groups, groupId)) throw new HttpError(400, 'الفئة غير موجودة.');
  }

  let notes = input.notes == null ? null : String(input.notes).trim();
  if (notes === '') notes = null;
  if (notes && notes.length > 200) throw new HttpError(400, 'الملاحظات طويلة جدًا.');

  return { day, start, end, subjectId: subject.id, groupId, notes };
}

function validateSubject(db, input, id) {
  const name = cleanName(input?.name);
  const year = Number(input.year);
  if (!YEARS.includes(year)) throw new HttpError(400, 'السنة الدراسية غير صالحة.');

  const departmentId = nullableId(input.departmentId);
  if (departmentId !== null) {
    if (year !== YEAR_WITH_DEPARTMENTS) throw new HttpError(400, 'القسم يُحدَّد للسنة الرابعة فقط.');
    if (!findIn(db.departments, departmentId)) throw new HttpError(400, 'القسم غير موجود.');
  }
  if (!findIn(db.teachers, input.teacherId)) throw new HttpError(400, 'اختر الأستاذ المسؤول.');

  const dup = db.subjects.find(
    (s) => s.id !== id && s.year === year && (s.departmentId ?? null) === departmentId && same(s.name, name),
  );
  if (dup) throw new HttpError(409, 'هذه المادة موجودة مسبقًا في نفس السنة.');

  const seenGroups = new Set();
  const channels = [];
  for (const c of Array.isArray(input.channels) ? input.channels : []) {
    const groupId = nullableId(c.groupId);
    if (groupId !== null) {
      if (!YEARS_WITH_GROUPS.includes(year)) throw new HttpError(400, 'لا توجد فئات في هذه السنة.');
      if (!findIn(db.groups, groupId)) throw new HttpError(400, 'الفئة غير موجودة.');
    }
    const key = groupId ?? '*';
    if (seenGroups.has(key)) throw new HttpError(400, 'يوجد أكثر من رابط لنفس الفئة.');
    seenGroups.add(key);
    const url = validateUrl(c.url, { telegram: true });
    if (!url) continue; // الرابط الفارغ = لا قناة بعد
    channels.push({ id: c.id || newId(), groupId, url, enabled: c.enabled !== false });
  }

  return { name, year, departmentId, teacherId: input.teacherId, channels };
}

function validateTeacher(db, input, id) {
  const name = cleanName(input?.name);
  if (db.teachers.some((t) => t.id !== id && same(t.name, name))) {
    throw new HttpError(409, 'هذا الأستاذ موجود مسبقًا.');
  }
  const contacts = [];
  for (const c of Array.isArray(input.contacts) ? input.contacts : []) {
    const type = String(c.type ?? '');
    if (!CONTACT_TYPES.includes(type)) throw new HttpError(400, 'نوع وسيلة التواصل غير معروف.');
    let value = String(c.value ?? '').trim();
    if (!value) continue;
    if (type === 'whatsapp' || type === 'phone') {
      value = value.replace(/[^\d]/g, '').replace(/^00/, '');
      if (value.length < 8 || value.length > 15) {
        throw new HttpError(400, 'رقم الهاتف غير صالح. اكتبه مع رمز الدولة، مثل 963935350049.');
      }
    } else {
      value = validateUrl(value, { telegram: type === 'telegram' });
    }
    const label = c.label == null ? null : String(c.label).trim().slice(0, 40) || null;
    contacts.push({ id: c.id || newId(), type, value, label });
  }
  return { name, contacts };
}

// ---------- العمليات ----------

export const ops = {
  saveLecture(db, input) {
    const clean = validateLecture(db, input ?? {});
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

  saveSubject(db, input) {
    const id = input?.id || null;
    const clean = validateSubject(db, input ?? {}, id);
    if (id) {
      const i = db.subjects.findIndex((s) => s.id === id);
      if (i < 0) throw new HttpError(404, 'المادة غير موجودة.');
      // تغيير سنة المادة يجعل فئات محاضراتها غير صالحة إن لم تعد السنة تحتوي فئات.
      if (!YEARS_WITH_GROUPS.includes(clean.year) && db.lectures.some((l) => l.subjectId === id && l.groupId)) {
        throw new HttpError(400, 'للمادة محاضرات مرتبطة بفئات، ولا توجد فئات في السنة الجديدة. عدّل المحاضرات أولًا.');
      }
      db.subjects[i] = { id, ...clean };
      return { id };
    }
    const newSubjectId = newId();
    db.subjects.push({ id: newSubjectId, ...clean });
    return { id: newSubjectId };
  },

  deleteSubject(db, { id }) {
    if (!findIn(db.subjects, id)) throw new HttpError(404, 'المادة غير موجودة.');
    const used = db.lectures.filter((l) => l.subjectId === id).length;
    if (used > 0) {
      throw new HttpError(409, `لا يمكن حذف المادة لأن لها ${used} من المواعيد. احذف مواعيدها أولًا.`);
    }
    db.subjects = db.subjects.filter((s) => s.id !== id);
    return { ok: true };
  },

  saveTeacher(db, input) {
    const id = input?.id || null;
    const clean = validateTeacher(db, input ?? {}, id);
    if (id) {
      const i = db.teachers.findIndex((t) => t.id === id);
      if (i < 0) throw new HttpError(404, 'الأستاذ غير موجود.');
      db.teachers[i] = { id, ...clean };
      return { id };
    }
    const tid = newId();
    db.teachers.push({ id: tid, ...clean });
    return { id: tid };
  },

  deleteTeacher(db, { id }) {
    if (!findIn(db.teachers, id)) throw new HttpError(404, 'الأستاذ غير موجود.');
    const used = db.subjects.filter((s) => s.teacherId === id).length;
    if (used > 0) {
      throw new HttpError(409, `لا يمكن حذف الأستاذ لأنه مسؤول عن ${used} من المواد. انقلها لأستاذ آخر أولًا.`);
    }
    db.teachers = db.teachers.filter((t) => t.id !== id);
    return { ok: true };
  },

  addLookup(db, { kind, name }) {
    const k = LOOKUPS[kind];
    if (!k) throw new HttpError(400, 'نوع القائمة غير معروف.');
    const n = cleanName(name, 40);
    if (db[k.field].some((x) => same(x.name, n))) throw new HttpError(409, 'هذا الاسم موجود مسبقًا.');
    const item = { id: newId(), name: n };
    db[k.field].push(item);
    return { item };
  },

  renameLookup(db, { kind, id, name }) {
    const k = LOOKUPS[kind];
    if (!k) throw new HttpError(400, 'نوع القائمة غير معروف.');
    const n = cleanName(name, 40);
    const item = findIn(db[k.field], id);
    if (!item) throw new HttpError(404, 'العنصر غير موجود.');
    if (db[k.field].some((x) => x.id !== id && same(x.name, n))) throw new HttpError(409, 'هذا الاسم موجود مسبقًا.');
    item.name = n;
    return { ok: true };
  },

  deleteLookup(db, { kind, id }) {
    const k = LOOKUPS[kind];
    if (!k) throw new HttpError(400, 'نوع القائمة غير معروف.');
    if (!findIn(db[k.field], id)) throw new HttpError(404, 'العنصر غير موجود.');
    const used =
      kind === 'group'
        ? db.lectures.filter((l) => l.groupId === id).length +
          db.subjects.filter((s) => (s.channels ?? []).some((c) => c.groupId === id)).length
        : db.subjects.filter((s) => s.departmentId === id).length;
    if (used > 0) {
      throw new HttpError(409, `لا يمكن حذف ${k.label} لأنها مستخدمة في ${used} من المواد أو المواعيد.`);
    }
    db[k.field] = db[k.field].filter((x) => x.id !== id);
    return { ok: true };
  },
};

// ---------- البيانات الأولى ----------

export function buildSeed() {
  const db = emptyDb();
  const byName = (list, name, what) => {
    const found = list.find((x) => same(x.name, name));
    if (!found) throw new Error(`seed: ${what} غير موجود: ${name}`);
    return found.id;
  };

  for (const g of SEED.groups) db.groups.push({ id: newId(), name: g });
  for (const d of SEED.departments) db.departments.push({ id: newId(), name: d });
  for (const t of SEED.teachers) {
    db.teachers.push({ id: newId(), ...validateTeacher(db, t, null) });
  }
  for (const s of SEED.subjects) {
    db.subjects.push({
      id: newId(),
      ...validateSubject(
        db,
        {
          name: s.name,
          year: s.year,
          departmentId: s.department ? byName(db.departments, s.department, 'قسم') : null,
          teacherId: byName(db.teachers, s.teacher, 'أستاذ'),
          channels: [],
        },
        null,
      ),
    });
  }
  for (const l of SEED.lectures) {
    const subject = db.subjects.find((s) => s.year === l.year && same(s.name, l.subject));
    if (!subject) throw new Error(`seed: مادة غير موجودة: ${l.subject} (سنة ${l.year})`);
    db.lectures.push({
      id: newId(),
      ...validateLecture(db, {
        day: l.day,
        start: l.start,
        end: l.end,
        subjectId: subject.id,
        groupId: l.group ? byName(db.groups, l.group, 'فئة') : null,
      }),
    });
  }
  db.updatedAt = null;
  return db;
}
