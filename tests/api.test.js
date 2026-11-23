import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.ALWASIT_MEMORY_STORE = '1';
process.env.ADMIN_PASSWORD = 'secret-123';

const { default: schedule } = await import('../api/schedule.js');
const { default: admin } = await import('../api/admin.js');
const { _memoryBackend } = await import('../lib/store.js');

function call(handler, { method = 'GET', body, token, ip = '1.1.1.1' } = {}) {
  return new Promise((resolve) => {
    const headers = { 'x-forwarded-for': ip };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(c) { this.statusCode = c; return this; },
      send(s) { resolve({ status: this.statusCode, body: JSON.parse(s), headers: this.headers }); },
      end() { resolve({ status: this.statusCode, body: null, headers: this.headers }); },
    };
    handler({ method, headers, body }, res);
  });
}

async function session() {
  const r = await call(admin, { method: 'POST', body: { action: 'login', password: 'secret-123' } });
  assert.equal(r.status, 200);
  const token = r.body.token;
  return (body) => call(admin, { method: 'POST', body, token });
}

const snap = async () => (await call(schedule)).body;
const lecturesOn = (s, day) => s.lectures.filter((l) => l.day === day);

beforeEach(() => _memoryBackend._reset());

test('البيانات الرسمية كاملة: 26 موعدًا و17 مادة وأستاذان', async () => {
  const s = await snap();
  assert.equal(s.lectures.length, 26);
  assert.equal(s.subjects.length, 17);
  assert.deepEqual(s.teachers.map((t) => t.name), ['شعبان شحود', 'يونس شحود']);
  assert.deepEqual(s.departments.map((d) => d.name), ['الجبر', 'التحليل', 'التطبيقية']);
  const perDay = Object.fromEntries(
    ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => [d, lecturesOn(s, d).length]),
  );
  assert.deepEqual(perDay, { saturday: 7, sunday: 6, monday: 4, tuesday: 2, wednesday: 2, thursday: 2, friday: 3 });
  // لا توبولوجيا يوم الثلاثاء
  assert.ok(!lecturesOn(s, 'tuesday').some((l) => l.subjectName.includes('التوبولوجيا')));
  // لا فئات في الثالثة والرابعة
  assert.ok(s.lectures.filter((l) => l.year >= 3).every((l) => l.groupId === null));
  // الجبر الخطي 1 مشتركة بين A وB
  const linear = s.lectures.find((l) => l.subjectName === 'الجبر الخطي 1');
  assert.equal(linear.groupId, null);
  assert.equal(linear.teacherName, 'شعبان شحود');
  // المادتان المختلفتان لا تُدمجان
  const names = s.subjects.map((x) => x.name);
  assert.ok(names.includes('ميكانيك النقطة المادية') && names.includes('ميكانيك المرونة'));
  // القنوات فارغة، وروابط الأساتذة موجودة
  assert.ok(s.subjects.every((x) => x.channels.length === 0));
  const shaaban = s.teachers.find((t) => t.name === 'شعبان شحود');
  assert.deepEqual(shaaban.contacts.map((c) => [c.type, c.value]), [
    ['whatsapp', '963935350049'],
    ['telegram', 'https://t.me/shabanshahoud2'],
    ['facebook', 'https://www.facebook.com/share/1A8skHVGTf/'],
  ]);
  // المعرفات ثابتة بين القراءات
  assert.equal((await snap()).lectures[0].id, s.lectures[0].id);
});

test('الكتابة مرفوضة بدون دخول أو بكلمة مرور خاطئة', async () => {
  let r = await call(admin, { method: 'POST', body: { action: 'deleteLecture', id: 'x' } });
  assert.equal(r.status, 401);
  r = await call(admin, { method: 'POST', body: { action: 'deleteLecture', id: 'x' }, token: '9999999999999.abc' });
  assert.equal(r.status, 401);
  r = await call(admin, { method: 'POST', body: { action: 'login', password: 'wrong' } });
  assert.equal(r.status, 401);
});

test('حماية من تخمين كلمة المرور', async () => {
  let r;
  for (let i = 0; i < 11; i++) {
    r = await call(admin, { method: 'POST', body: { action: 'login', password: 'nope' }, ip: '9.9.9.9' });
  }
  assert.equal(r.status, 429);
  r = await call(admin, { method: 'POST', body: { action: 'login', password: 'secret-123' }, ip: '8.8.8.8' });
  assert.equal(r.status, 200);
});

test('المواعيد: تعديل وحذف وقواعد الفئات', async () => {
  const post = await session();
  const s = await snap();
  const cpp = s.subjects.find((x) => x.name === 'البرمجة بلغة C++');
  const groupA = s.groups.find((g) => g.name === 'A');

  // لا فئات في السنة الثالثة
  let r = await post({ action: 'saveLecture', lecture: { day: 'monday', start: 600, end: 700, subjectId: cpp.id, groupId: groupA.id } });
  assert.equal(r.status, 400);
  r = await post({ action: 'saveLecture', lecture: { day: 'monday', start: 700, end: 600, subjectId: cpp.id } });
  assert.equal(r.status, 400);

  r = await post({ action: 'saveLecture', lecture: { day: 'monday', start: 600, end: 700, subjectId: cpp.id } });
  assert.equal(r.status, 200);
  let after = await snap();
  const added = after.lectures.find((l) => l.id === r.body.id);
  assert.equal(added.year, 3);
  assert.equal(added.teacherName, 'شعبان شحود');

  r = await post({ action: 'saveLecture', lecture: { ...added, notes: 'القاعة 3' } });
  assert.equal(r.status, 200);
  assert.equal((await snap()).lectures.find((l) => l.id === added.id).notes, 'القاعة 3');

  assert.equal((await post({ action: 'deleteLecture', id: added.id })).status, 200);
  assert.equal((await snap()).lectures.length, 26);
});

test('المواد وقنوات تيليغرام: مشتركة أو لكل فئة', async () => {
  const post = await session();
  const s = await snap();
  const topo = s.subjects.find((x) => x.name === 'التوبولوجيا العامة 1');
  const [A, B] = ['A', 'B'].map((n) => s.groups.find((g) => g.name === n));

  let r = await post({ action: 'saveSubject', subject: { ...topo, channels: [{ groupId: null, url: 'https://example.com/x' }] } });
  assert.equal(r.status, 400, 'رابط غير تيليغرام مرفوض');

  r = await post({
    action: 'saveSubject',
    subject: {
      ...topo,
      channels: [
        { groupId: null, url: 'https://t.me/+shared' },
        { groupId: B.id, url: 'https://t.me/topoB', enabled: false },
        { groupId: A.id, url: '' },
      ],
    },
  });
  assert.equal(r.status, 200);
  const saved = (await snap()).subjects.find((x) => x.id === topo.id);
  assert.deepEqual(
    saved.channels.map((c) => [c.groupName, c.url, c.enabled]),
    [[null, 'https://t.me/+shared', true], ['B', 'https://t.me/topoB', false]],
  );

  // لا فئات لقنوات مادة من السنة الثالثة
  const cpp = s.subjects.find((x) => x.name === 'البرمجة بلغة C++');
  r = await post({ action: 'saveSubject', subject: { ...cpp, channels: [{ groupId: A.id, url: 'https://t.me/c' }] } });
  assert.equal(r.status, 400);

  // القسم للسنة الرابعة فقط
  const alg = s.departments.find((d) => d.name === 'الجبر');
  r = await post({ action: 'saveSubject', subject: { ...cpp, departmentId: alg.id } });
  assert.equal(r.status, 400);

  // مادة جديدة لقسم الجبر
  const shaaban = s.teachers.find((t) => t.name === 'شعبان شحود');
  r = await post({ action: 'saveSubject', subject: { name: 'الجبر المجرد', year: 4, departmentId: alg.id, teacherId: shaaban.id } });
  assert.equal(r.status, 200);
  r = await post({ action: 'saveSubject', subject: { name: 'الجبر  المجرد', year: 4, departmentId: alg.id, teacherId: shaaban.id } });
  assert.equal(r.status, 409);

  // لا تُحذف مادة لها مواعيد
  r = await post({ action: 'deleteSubject', id: cpp.id });
  assert.equal(r.status, 409);
});

test('الأساتذة ووسائل التواصل', async () => {
  const post = await session();
  const s = await snap();
  const younis = s.teachers.find((t) => t.name === 'يونس شحود');

  let r = await post({
    action: 'saveTeacher',
    teacher: { ...younis, contacts: [...younis.contacts, { type: 'whatsapp', value: '+963 94 746 8663' }] },
  });
  assert.equal(r.status, 200);
  const updated = (await snap()).teachers.find((t) => t.id === younis.id);
  assert.equal(updated.contacts.at(-1).value, '963947468663');

  r = await post({ action: 'saveTeacher', teacher: { name: 'أستاذ', contacts: [{ type: 'whatsapp', value: '12' }] } });
  assert.equal(r.status, 400);
  r = await post({ action: 'saveTeacher', teacher: { name: 'أستاذ جديد', contacts: [] } });
  assert.equal(r.status, 200);
  assert.equal((await post({ action: 'deleteTeacher', id: r.body.id })).status, 200);
  assert.equal((await post({ action: 'deleteTeacher', id: younis.id })).status, 409);
});

test('بدون إعداد قاعدة البيانات تظهر رسالة واضحة', async () => {
  delete process.env.ALWASIT_MEMORY_STORE;
  try {
    const r = await call(schedule);
    assert.equal(r.status, 503);
    assert.match(r.body.error, /Redis/);
  } finally {
    process.env.ALWASIT_MEMORY_STORE = '1';
  }
});
