// منطق الموقع: الفلترة والترتيب ونص واتساب والعناوين.
// يطابق منطق التطبيق (app/lib/logic) ومُختبر في tests/logic.test.js.

export const DAYS = [
  ['saturday', 'السبت'],
  ['sunday', 'الأحد'],
  ['monday', 'الإثنين'],
  ['tuesday', 'الثلاثاء'],
  ['wednesday', 'الأربعاء'],
  ['thursday', 'الخميس'],
  ['friday', 'الجمعة'],
];
export const DAY_NAME = Object.fromEntries(DAYS);
export const DAY_INDEX = Object.fromEntries(DAYS.map(([k], i) => [k, i]));
export const YEARS = [1, 2, 3, 4];
export const YEAR_WITH_GROUPS = 2;
export const YEAR_WITH_DEPARTMENTS = 4;
export const YEARS_ALLOWING_GROUPS = [1, 2];
export const CENTER = 'مركز الوسيط';

const ORD = { 1: 'الأولى', 2: 'الثانية', 3: 'الثالثة', 4: 'الرابعة' };
export const yearName = (y) => `السنة ${ORD[y] ?? y}`;
export const yearShort = (y) => `سنة ${(ORD[y] ?? String(y)).replace(/^ال/, '')}`;
export const deptShort = (n) => (n.startsWith('ال') && n.length > 3 ? n.slice(2) : n);

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

/** يمنع ظهور «C++» بالشكل «++C» داخل نص عربي (علامة اتجاه غير مرئية). */
export const bidi = (s) => String(s ?? '').replace(/([A-Za-z][A-Za-z0-9]*[+#]+)(?!\u200E)/g, '$1\u200E');

// ---------- الوقت (نظام 12 ساعة) ----------

const clock = (m) => {
  let h = Math.floor(m / 60) % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m % 60).padStart(2, '0')}`;
};
const period = (m) => (Math.floor(m / 60) < 12 ? 'ص' : 'م');
export const time12 = (m) => `${clock(m)} ${period(m)}`;
export const range12 = (a, b) =>
  period(a) === period(b) ? `${clock(a)} - ${clock(b)} ${period(b)}` : `${time12(a)} - ${time12(b)}`;
export const rangeBare = (a, b) => `${clock(a)} - ${clock(b)}`;
export const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const fromHHMM = (s) => {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + m;
};

// ---------- الفلترة ----------

export function compareLectures(a, b) {
  return (
    DAY_INDEX[a.day] - DAY_INDEX[b.day] ||
    a.start - b.start ||
    a.end - b.end ||
    a.year - b.year ||
    (a.groupName ?? '').localeCompare(b.groupName ?? '') ||
    a.subjectName.localeCompare(b.subjectName, 'ar')
  );
}

/** q = { day, year, groupId, departmentId, text } — null تعني «الكل». */
export function filterLectures(lectures, q) {
  const needle = normalizeArabic(q.text ?? '');
  return lectures
    .filter((l) => {
      if (q.day && l.day !== q.day) return false;
      if (q.year && l.year !== q.year) return false;
      if (q.groupId && l.groupId && l.groupId !== q.groupId) return false;
      if (q.departmentId && l.departmentId && l.departmentId !== q.departmentId) return false;
      if (needle && !normalizeArabic(l.subjectName).includes(needle) && !normalizeArabic(l.teacherName).includes(needle)) {
        return false;
      }
      return true;
    })
    .sort(compareLectures);
}

export function byDay(sorted) {
  const map = new Map();
  for (const l of sorted) {
    if (!map.has(l.day)) map.set(l.day, []);
    map.get(l.day).push(l);
  }
  return map;
}

export function exactSlots(sameDay) {
  const slots = [];
  for (const l of sameDay) {
    const last = slots.at(-1);
    if (last && last.start === l.start && last.end === l.end) last.lectures.push(l);
    else slots.push({ start: l.start, end: l.end, lectures: [l] });
  }
  return slots;
}

export function overlapClusters(sameDay) {
  const clusters = [];
  let end = -1;
  for (const l of sameDay) {
    if (clusters.length && l.start < end) {
      clusters.at(-1).push(l);
      end = Math.max(end, l.end);
    } else {
      clusters.push([l]);
      end = l.end;
    }
  }
  return clusters;
}

export function yearHasGroups(data, year) {
  if (!year || !YEARS_ALLOWING_GROUPS.includes(year)) return false;
  if (year === YEAR_WITH_GROUPS) return data.groups.length > 0;
  return (
    data.lectures.some((l) => l.year === year && l.groupId) ||
    data.subjects.some((s) => s.year === year && s.channels.some((c) => c.groupId))
  );
}

// ---------- العناوين ----------

export function audience({ year, groupName, departmentName, hasGroups, text }) {
  let s;
  if (!year) s = 'لجميع السنوات';
  else {
    s = `لل${yearName(year).slice(2)}`;
    if (year === YEAR_WITH_DEPARTMENTS) s += departmentName ? `، قسم ${departmentName}` : '، جميع الأقسام';
    else if (hasGroups) s += groupName ? `، الفئة ${groupName}` : '، جميع الفئات';
  }
  if (text && text.trim()) s += `، بحث: «${text.trim()}»`;
  return s;
}

export const daysText = (day) => (day ? `يوم ${DAY_NAME[day]}` : 'جميع الأيام');

// ---------- رسالة واتساب ----------

export const EMPTY_TEXT = 'لا توجد محاضرات ضمن الاختيارات المحددة';

export function lectureDetails(l, { showYear, showDepartment, allGroupsLabel }) {
  const parts = [];
  if (showYear) parts.push(yearShort(l.year));
  if (l.groupName) parts.push(`فئة ${l.groupName}`);
  else if (l.year === YEAR_WITH_GROUPS && allGroupsLabel) parts.push(allGroupsLabel);
  if (showDepartment && l.departmentName) parts.push(deptShort(l.departmentName));
  return parts.length ? ` (${parts.join('، ')})` : '';
}

export function shareMessage({ lectures, day, audienceText, showYear, showDepartment, allGroupsLabel, now = new Date() }) {
  const lines = [
    now.getHours() < 12 ? 'صباح الخير جميعاً😍' : 'مساء الخير جميعاً😍',
    `🟡 مواعيد ${daysText(day)}`,
    audienceText,
    'في:',
    `👑 ${CENTER} 👑`,
  ];
  const sorted = [...lectures].sort(compareLectures);
  if (!sorted.length) lines.push(EMPTY_TEXT);
  for (const [d, list] of byDay(sorted)) {
    if (!day) lines.push(`📅 يوم ${DAY_NAME[d]}`);
    for (const slot of exactSlots(list)) {
      lines.push(`🕒 ${rangeBare(slot.start, slot.end)}:`);
      for (const l of slot.lectures) {
        lines.push(`∆ ${bidi(l.subjectName)}${lectureDetails(l, { showYear, showDepartment, allGroupsLabel })}`);
      }
    }
  }
  lines.push('بالتوفيق للجميع❤️');
  return lines.map((l) => `*${l}*`).join('\n\n');
}

// ---------- الحضور أونلاين ----------

export function filterSubjects(subjects, { year, departmentId, text }) {
  const needle = normalizeArabic(text ?? '');
  return subjects
    .filter((s) => {
      if (year && s.year !== year) return false;
      if (departmentId && s.departmentId && s.departmentId !== departmentId) return false;
      if (needle && !normalizeArabic(s.name).includes(needle) && !normalizeArabic(s.teacherName).includes(needle)) return false;
      return true;
    })
    .sort((a, b) => a.year - b.year || (a.departmentName ?? '').localeCompare(b.departmentName ?? '') || a.name.localeCompare(b.name, 'ar'));
}

export function channelsFor(subject, groupId) {
  const usable = subject.channels.filter((c) => c.enabled && c.url);
  if (groupId) {
    const own = usable.find((c) => c.groupId === groupId);
    return own ? [own] : usable.filter((c) => !c.groupId);
  }
  return usable.sort((a, b) => (a.groupId ? 1 : 0) - (b.groupId ? 1 : 0) || (a.groupName ?? '').localeCompare(b.groupName ?? ''));
}

// ---------- التواصل ----------

export const DEFAULT_TEACHER_MESSAGE = `السلام عليكم أستاذ، أنا أحد طلاب ${CENTER}، وأرغب بالاستفسار عن `;

export function contactHref(c, message = DEFAULT_TEACHER_MESSAGE) {
  if (c.type === 'whatsapp') return `https://wa.me/${c.value}?text=${encodeURIComponent(message)}`;
  if (c.type === 'phone') return `tel:+${c.value}`;
  return c.value;
}

export const CONTACT_LABEL = {
  whatsapp: 'واتساب',
  telegram: 'تيليغرام',
  facebook: 'فيسبوك',
  phone: 'اتصال هاتفي',
  other: 'رابط آخر',
};
