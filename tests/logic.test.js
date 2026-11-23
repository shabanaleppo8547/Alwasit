// اختبار منطق الموقع على البيانات الرسمية الحقيقية من الخادم.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ALWASIT_MEMORY_STORE = '1';
const { buildSeed, toPublic } = await import('../lib/db.js');
const L = await import('../public/logic.js');

const data = toPublic(buildSeed());
const groupB = data.groups.find((g) => g.name === 'B');
const applied = data.departments.find((d) => d.name === 'التطبيقية');

test('رسالة الأربعاء لجميع السنوات مطابقة حرفيًا للتنسيق المعتمد', () => {
  const lectures = L.filterLectures(data.lectures, { day: 'wednesday' });
  const msg = L.shareMessage({
    lectures,
    day: 'wednesday',
    audienceText: L.audience({ year: null }),
    showYear: true,
    showDepartment: true,
    allGroupsLabel: 'A وB',
    now: new Date(2026, 10, 25, 18),
  });
  assert.equal(
    msg.replaceAll('\u200E', ''),
    [
      'مساء الخير جميعاً😍',
      '🟡 مواعيد يوم الأربعاء',
      'لجميع السنوات',
      'في:',
      '👑 مركز الوسيط 👑',
      '🕒 2:30 - 4:00:',
      '∆ النمذجة الرياضية (سنة رابعة، تطبيقية)',
      '🕒 4:00 - 7:00:',
      '∆ البرمجة بلغة C++ (سنة ثالثة)',
      'بالتوفيق للجميع❤️',
    ]
      .map((l) => `*${l}*`)
      .join('\n\n'),
  );
});

test('الفلاتر المترابطة على الجدول الرسمي', () => {
  const ids = (q) => L.filterLectures(data.lectures, q).map((l) => `${l.day} ${L.toHHMM(l.start)} ${l.subjectName}`);
  assert.deepEqual(ids({ day: 'monday', year: 2, groupId: groupB.id }), [
    'monday 11:00 الجبر الخطي 1',
    'monday 13:00 المعادلات التفاضلية 1',
  ]);
  assert.equal(L.filterLectures(data.lectures, { year: 4, departmentId: applied.id }).length, 6);
  assert.equal(L.filterLectures(data.lectures, { year: 3 }).length, 9);
  assert.equal(L.filterLectures(data.lectures, { year: 1 }).length, 0);
  assert.equal(L.filterLectures(data.lectures, { day: 'saturday', year: 4 }).length, 4);
  assert.equal(L.filterLectures(data.lectures, {}).length, 26);
});

test('C++ لا تنقلب في النص العربي', () => {
  assert.equal(L.bidi('البرمجة بلغة C++'), 'البرمجة بلغة C++\u200E');
  assert.equal(L.bidi(L.bidi('C#')), 'C#\u200E');
  assert.equal(L.bidi('البرمجة بلغة بايثون'), 'البرمجة بلغة بايثون');
});

test('العناوين والفئات', () => {
  assert.equal(L.yearHasGroups(data, 2), true);
  assert.equal(L.yearHasGroups(data, 3), false);
  assert.equal(L.yearHasGroups(data, 1), false);
  assert.equal(L.audience({ year: 2, groupName: 'A', hasGroups: true }), 'للسنة الثانية، الفئة A');
  assert.equal(L.audience({ year: 4 }), 'للسنة الرابعة، جميع الأقسام');
  assert.equal(L.audience({ year: 4, departmentName: 'التطبيقية' }), 'للسنة الرابعة، قسم التطبيقية');
  assert.equal(L.range12(9 * 60, 11 * 60), '9:00 - 11:00 ص');
  assert.equal(L.range12(11 * 60, 13 * 60), '11:00 ص - 1:00 م');
});

test('لا محاضرات مطابقة', () => {
  const msg = L.shareMessage({
    lectures: [], day: 'friday', audienceText: L.audience({ year: 1 }),
    showYear: false, showDepartment: true, allGroupsLabel: '', now: new Date(2026, 10, 27, 9),
  });
  assert.match(msg, /\*لا توجد محاضرات ضمن الاختيارات المحددة\*/);
  assert.match(msg, /^\*صباح الخير/);
});

test('الحضور أونلاين والتواصل', () => {
  assert.equal(L.filterSubjects(data.subjects, { year: 4, departmentId: applied.id }).length, 4);
  assert.equal(L.filterSubjects(data.subjects, { year: 2 }).length, 5);
  const topo = { channels: [
    { groupId: null, url: 'https://t.me/s', enabled: true },
    { groupId: groupB.id, groupName: 'B', url: 'https://t.me/b', enabled: true },
  ] };
  assert.deepEqual(L.channelsFor(topo, groupB.id).map((c) => c.url), ['https://t.me/b']);
  assert.deepEqual(L.channelsFor(topo, 'other').map((c) => c.url), ['https://t.me/s']);
  const wa = data.teachers[0].contacts.find((c) => c.type === 'whatsapp');
  assert.ok(L.contactHref(wa).startsWith('https://wa.me/963935350049?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85'));
});
