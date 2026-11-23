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

async function loginToken() {
  const r = await call(admin, { method: 'POST', body: { action: 'login', password: 'secret-123' } });
  assert.equal(r.status, 200);
  return r.body.token;
}

beforeEach(() => _memoryBackend._reset());

test('الطالب يقرأ البيانات الأولى المؤكدة فقط، والمعرّفات ثابتة', async () => {
  const a = await call(schedule);
  assert.equal(a.status, 200);
  assert.equal(a.headers['cache-control'], 'no-store, max-age=0');
  assert.equal(a.body.lectures.length, 1);
  const l = a.body.lectures[0];
  assert.deepEqual(
    [l.day, l.start, l.end, l.year, l.subjectName, l.teacherName, l.groupName, l.departmentName],
    ['tuesday', 990, 1140, 3, 'برمجة C++', 'شعبان', null, null],
  );
  assert.deepEqual(a.body.lookups.group.map((g) => g.name), ['A', 'B']);
  assert.equal(a.body.lookups.department.length, 3);
  const b = await call(schedule);
  assert.equal(b.body.lectures[0].id, l.id);
  assert.equal(b.body.lookups.subject[0].id, a.body.lookups.subject[0].id);
});

test('الكتابة مرفوضة بدون تسجيل دخول أو بكلمة مرور خاطئة', async () => {
  let r = await call(admin, { method: 'POST', body: { action: 'addLookup', kind: 'subject', name: 'x' } });
  assert.equal(r.status, 401);
  r = await call(admin, { method: 'POST', body: { action: 'addLookup', kind: 'subject', name: 'x' }, token: '9999999999999.abc' });
  assert.equal(r.status, 401);
  r = await call(admin, { method: 'POST', body: { action: 'login', password: 'wrong' } });
  assert.equal(r.status, 401);
  assert.match(r.body.error, /غير صحيحة/);
});

test('حماية من تخمين كلمة المرور', async () => {
  let r;
  for (let i = 0; i < 11; i++) {
    r = await call(admin, { method: 'POST', body: { action: 'login', password: 'nope' }, ip: '9.9.9.9' });
  }
  assert.equal(r.status, 429);
  r = await call(admin, { method: 'POST', body: { action: 'login', password: 'secret-123' }, ip: '9.9.9.9' });
  assert.equal(r.status, 429);
  r = await call(admin, { method: 'POST', body: { action: 'login', password: 'secret-123' }, ip: '8.8.8.8' });
  assert.equal(r.status, 200);
});

test('دورة كاملة: إضافة وتعديل وحذف وتظهر للطلاب فورًا', async () => {
  const token = await loginToken();
  const post = (body) => call(admin, { method: 'POST', body, token });

  const subj = await post({ action: 'addLookup', kind: 'subject', name: 'تحليل عقدي' });
  assert.equal(subj.status, 200);
  const teach = await post({ action: 'addLookup', kind: 'teacher', name: 'سامر' });
  const snap0 = (await call(schedule)).body;
  const alg = snap0.lookups.department.find((d) => d.name === 'الجبر');
  const grpA = snap0.lookups.group.find((g) => g.name === 'A');

  const dup = await post({ action: 'addLookup', kind: 'teacher', name: '  سامر ' });
  assert.equal(dup.status, 409);

  const add = await post({
    action: 'saveLecture',
    lecture: { day: 'tuesday', start: 990, end: 1140, year: 4, subjectId: subj.body.item.id,
      teacherId: teach.body.item.id, groupId: grpA.id, departmentId: alg.id },
  });
  assert.equal(add.status, 200);

  let snap = (await call(schedule)).body;
  assert.equal(snap.lectures.length, 2, 'المحاضرتان المتزامنتان موجودتان معًا');
  const mine = snap.lectures.find((l) => l.id === add.body.id);
  assert.equal(mine.departmentName, 'الجبر');
  assert.equal(mine.groupName, 'A');

  const bad = await post({ action: 'saveLecture', lecture: { ...mine, start: 1140, end: 990 } });
  assert.equal(bad.status, 400);
  const badDept = await post({ action: 'saveLecture', lecture: { ...mine, year: 2 } });
  assert.equal(badDept.status, 400);

  const edit = await post({ action: 'saveLecture', lecture: { ...mine, notes: 'القاعة 3' } });
  assert.equal(edit.status, 200);
  snap = (await call(schedule)).body;
  assert.equal(snap.lectures.find((l) => l.id === mine.id).notes, 'القاعة 3');

  const inUse = await post({ action: 'deleteLookup', kind: 'teacher', id: teach.body.item.id });
  assert.equal(inUse.status, 409);

  const ren = await post({ action: 'renameLookup', kind: 'teacher', id: teach.body.item.id, name: 'أ. سامر' });
  assert.equal(ren.status, 200);
  snap = (await call(schedule)).body;
  assert.equal(snap.lectures.find((l) => l.id === mine.id).teacherName, 'أ. سامر');

  assert.equal((await post({ action: 'deleteLecture', id: mine.id })).status, 200);
  assert.equal((await post({ action: 'deleteLookup', kind: 'teacher', id: teach.body.item.id })).status, 200);
  snap = (await call(schedule)).body;
  assert.equal(snap.lectures.length, 1);
  assert.ok(snap.updatedAt);
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
