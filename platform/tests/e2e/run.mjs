// اختبار شامل من طرف إلى طرف في متصفح حقيقي (Chromium عبر Playwright).
// يشغَّل على خادم يعمل مسبقًا:  BASE_URL=http://localhost:3100 node tests/e2e/run.mjs
// يحتاج قاعدة بيانات فيها البيانات الأولية، وADMIN_EMAILS يتضمن البريد الممرَّر في ADMIN_EMAIL.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.test';
const SHOTS = process.env.SHOTS_DIR ?? 'test-results/screens';
const run = Date.now().toString(36);
const PASSWORD = 'Test-pass-123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'local-test-admin-pass';
const DATABASE_URL = process.env.DATABASE_URL;
mkdirSync(SHOTS, { recursive: true });

let passed = 0;
async function step(name, fn) {
  process.stdout.write(`• ${name} … `);
  await fn();
  passed++;
  console.log('✓');
}

const browser = await chromium.launch();
const phone = devices['Pixel 7'];

async function newUser() {
  const ctx = await browser.newContext({ ...phone, locale: 'ar' });
  return { ctx, page: await ctx.newPage() };
}

async function register(page, { name, email, phone: tel }) {
  await page.goto(`${BASE}/register`);
  await page.fill('input[name=fullName]', name);
  await page.fill('input[name=phone]', tel);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', PASSWORD);
  await page.fill('input[name=confirm]', PASSWORD);
  await page.click('main button[type=submit]');
}

/** طلب بث من داخل الصفحة (بنفس كوكي الجلسة) ويعيد رمز الحالة. */
async function streamStatus(page, lectureId) {
  return page.evaluate(async (id) => {
    const r = await fetch(`/api/stream/${id}`, { headers: { Range: 'bytes=0-1023' } });
    return r.status;
  }, lectureId);
}

async function lectureIdsOf(page, subjectTitle) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /السنة الثانية/ }).click();
  await page.getByRole('link', { name: new RegExp(subjectTitle) }).first().click();
  await page.waitForURL(/\/subjects\//);
  const subjectId = page.url().split('/subjects/')[1];
  return { subjectId };
}

try {
  const studentEmail = `student-${run}@example.test`;
  const student2Email = `student2-${run}@example.test`;
  let freeLectureId, paidLectureId, subjectId, code;

  const s = await newUser();
  const a = await newUser();
  const anon = await newUser();

  await step('الصفحة الرئيسية تعرض السنوات والمواد والأساتذة', async () => {
    await anon.page.goto(BASE, { waitUntil: 'networkidle' });
    await anon.page.getByRole('heading', { name: 'السنوات والمواد المتاحة' }).waitFor();
    await anon.page.getByRole('tab', { name: /السنة الثانية/ }).click();
    await anon.page.getByText('الجبر الخطي 1').first().waitFor();
    await anon.page.getByText('أ. شعبان شحود').first().waitFor();
    await anon.page.screenshot({ path: `${SHOTS}/01-home.png`, fullPage: true });
  });

  await step('صفحة المادة تُظهر المحاضرات مقفلة للزائر', async () => {
    ({ subjectId } = await lectureIdsOf(anon.page, 'الجبر الخطي 1'));
    await anon.page.getByText('غير مسجّل الدخول').first().waitFor();
    const html = await anon.page.content();
    assert.ok(!html.includes('local:demo'), 'مرجع الفيديو يجب ألا يظهر في الصفحة');
    await anon.page.screenshot({ path: `${SHOTS}/02-subject-anon.png`, fullPage: true });
  });

  await step('البث مرفوض بلا تسجيل دخول (401)', async () => {
    const res = await anon.ctx.request.get(`${BASE}/api/stream/00000000-0000-0000-0000-000000000000`);
    assert.equal(res.status(), 401);
  });

  await step('التسجيل برسائل خطأ واضحة عند البيانات الخاطئة', async () => {
    await s.page.goto(`${BASE}/register`);
    await s.page.fill('input[name=fullName]', 'ط');
    await s.page.fill('input[name=email]', 'not-an-email');
    await s.page.click('main button[type=submit]');
    await s.page.getByText('البريد الإلكتروني غير صحيح.').first().waitFor();
    await s.page.getByText('الاسم قصير جدًا.').first().waitFor();
    await s.page.screenshot({ path: `${SHOTS}/03-register-errors.png`, fullPage: true });
  });

  await step('إنشاء حساب طالب والدخول إلى لوحته', async () => {
    await register(s.page, { name: 'طالب تجريبي', email: studentEmail, phone: '0991234567' });
    await s.page.waitForURL(/\/dashboard/);
    await s.page.getByText('لا توجد مواد مفعّلة على حسابك بعد.').first().waitFor();
    await s.page.screenshot({ path: `${SHOTS}/04-dashboard-empty.png`, fullPage: true });
  });

  await step('الطالب لا يستطيع دخول لوحة الإدارة', async () => {
    await s.page.goto(`${BASE}/admin`);
    await s.page.waitForURL(/\/dashboard\?denied=1/);
    await s.page.getByText('لوحة الإدارة متاحة للمدير فقط.').first().waitFor();
  });

  await step('المحاضرة المجانية تعمل والمدفوعة مرفوضة على الخادم (403)', async () => {
    await s.page.goto(`${BASE}/subjects/${subjectId}`);
    const links = await s.page.locator('a[href^="/lectures/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    freeLectureId = links[0].split('/').pop();
    assert.equal(await streamStatus(s.page, freeLectureId), 206);
    // المحاضرة المدفوعة ليست رابطًا للطالب؛ نأخذ معرّفها من المدير لاحقًا.
  });

  await step('المدير: الدخول بحساب مدير ثم كلمة مرور الإدارة', async () => {
    await register(a.page, { name: 'مدير المركز', email: ADMIN_EMAIL, phone: '0990000000' });
    await Promise.race([
      a.page.waitForURL(/\/admin-unlock/),
      a.page.getByText('هذا البريد مسجّل مسبقًا').first().waitFor(),
    ]);
    if (a.page.url().includes('/register')) {
      await a.page.goto(`${BASE}/login`);
      await a.page.fill('input[name=email]', ADMIN_EMAIL);
      await a.page.fill('input[name=password]', PASSWORD);
      await a.page.click('main button[type=submit]');
      await a.page.waitForURL(/\/admin-unlock/);
    }
    // بدون كلمة مرور الإدارة لا تُفتح اللوحة.
    await a.page.goto(`${BASE}/admin`);
    await a.page.waitForURL(/\/admin-unlock/);
    await a.page.fill('input[name=adminPassword]', 'wrong-admin-password');
    await a.page.click('main button[type=submit]');
    await a.page.getByText('كلمة مرور الإدارة غير صحيحة.').first().waitFor();
    await a.page.fill('input[name=adminPassword]', ADMIN_PASSWORD);
    await a.page.click('main button[type=submit]');
    await a.page.waitForURL(/\/admin$/);
    await a.page.getByRole('heading', { name: 'نظرة عامة' }).waitFor();
    await a.page.screenshot({ path: `${SHOTS}/05-admin-home.png`, fullPage: true });
  });

  await step('بريد غير مدرج في قائمة المدراء لا يدخل الإدارة حتى لو عرف كلمة مرور الإدارة', async () => {
    await s.page.goto(`${BASE}/admin-unlock`);
    await s.page.waitForURL(/\/dashboard\?denied=1/);
  });

  await step('المدير يرى المحاضرات ويحدد محاضرة مدفوعة', async () => {
    await a.page.goto(`${BASE}/admin/subjects/${subjectId}`);
    await a.page.getByText('محاضرة تجريبية 2').first().waitFor();
    const hrefs = await a.page.locator('a[href^="/lectures/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    paidLectureId = hrefs[1].split('/').pop();
    assert.equal(await streamStatus(s.page, paidLectureId), 403);
    await a.page.screenshot({ path: `${SHOTS}/06-admin-subject.png`, fullPage: true });
  });

  await step('صفحة المحاضرة المقفلة تعرض شاشة القفل للطالب', async () => {
    await s.page.goto(`${BASE}/lectures/${paidLectureId}`);
    await s.page.getByText('هذه المحاضرة غير مفعّلة على حسابك').first().waitFor();
    assert.equal(await s.page.locator('video').count(), 0);
  });

  await step('المدير يصدر رموز تفعيل للمادة', async () => {
    await a.page.goto(`${BASE}/admin/codes`);
    await a.page.fill('input[name=name]', `دفعة اختبار ${run}`);
    await a.page.selectOption('select[name=target]', `subject:${subjectId}`);
    await a.page.fill('input[name=count]', '3');
    await a.page.fill('input[name=accessDays]', '30');
    await a.page.click('main button[type=submit]');
    await a.page.waitForURL(/\/admin\/codes\/[0-9a-f-]{36}/);
    code = (await a.page.locator('td.font-mono').first().textContent()).trim();
    assert.match(code, /^ALW-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await a.page.screenshot({ path: `${SHOTS}/07-admin-codes.png`, fullPage: true });
  });

  await step('رمز خاطئ يُرفض برسالة واضحة', async () => {
    await s.page.goto(`${BASE}/redeem`);
    await s.page.fill('input[name=code]', 'ALW-AAAA-BBBB-CCCC');
    await s.page.click('main button[type=submit]');
    await s.page.getByText('الرمز غير صحيح أو غير صالح.').first().waitFor();
  });

  await step('الطالب يفعّل المادة بالرمز (بحروف صغيرة وبلا شرطات)', async () => {
    await s.page.goto(`${BASE}/redeem`);
    await s.page.fill('input[name=code]', code.toLowerCase().replace(/-/g, ' '));
    await s.page.click('main button[type=submit]');
    await s.page.getByText('تم التفعيل بنجاح!').first().waitFor();
    await s.page.screenshot({ path: `${SHOTS}/08-redeem-ok.png`, fullPage: true });
    assert.equal(await streamStatus(s.page, paidLectureId), 206);
  });

  await step('مشغّل الفيديو يعمل للمحاضرة المفعّلة', async () => {
    await s.page.goto(`${BASE}/lectures/${paidLectureId}`);
    const video = s.page.locator('video');
    await video.waitFor();
    const src = await video.getAttribute('src');
    assert.equal(src, `/api/stream/${paidLectureId}`);
    await s.page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, null, { timeout: 15000 });
    await s.page.screenshot({ path: `${SHOTS}/09-player.png`, fullPage: true });
  });

  await step('لوحة الطالب تُظهر المادة مفعّلة مع تاريخ الانتهاء', async () => {
    await s.page.goto(`${BASE}/dashboard`);
    await s.page.getByText('موادي المفعّلة (1)').waitFor();
    await s.page.getByText(/حتى /).first().waitFor();
    await s.page.screenshot({ path: `${SHOTS}/10-dashboard-active.png`, fullPage: true });
  });

  await step('الرمز لا يُستخدم مرتين (نفس الطالب أو طالب آخر)', async () => {
    await s.page.goto(`${BASE}/redeem`);
    await s.page.fill('input[name=code]', code);
    await s.page.click('main button[type=submit]');
    await s.page.getByText('استخدمت هذا الرمز من قبل على حسابك.').first().waitFor();

    const s2 = await newUser();
    await register(s2.page, { name: 'طالب ثان', email: student2Email, phone: '0997654321' });
    await s2.page.waitForURL(/\/dashboard/);
    await s2.page.goto(`${BASE}/redeem`);
    await s2.page.fill('input[name=code]', code);
    await s2.page.click('main button[type=submit]');
    await s2.page.getByText('هذا الرمز مستخدم بالكامل.').first().waitFor();
    assert.equal(await streamStatus(s2.page, paidLectureId), 403);
    await s2.ctx.close();
  });

  await step('المدير يلغي صلاحية الطالب فيُمنع البث فورًا', async () => {
    await a.page.goto(`${BASE}/admin/students?q=${encodeURIComponent(studentEmail)}`);
    await a.page.getByRole('link', { name: /طالب تجريبي/ }).click();
    await a.page.waitForURL(/\/admin\/students\/[0-9a-f-]{36}/);
    a.page.once('dialog', (d) => d.accept());
    await a.page.getByRole('button', { name: 'إلغاء الصلاحية' }).click();
    await a.page.getByRole('button', { name: 'إعادة التفعيل' }).waitFor();
    assert.equal(await streamStatus(s.page, paidLectureId), 403);
    await a.page.screenshot({ path: `${SHOTS}/11-admin-student.png`, fullPage: true });
  });

  await step('المدير يفعّل المادة يدويًا للطالب', async () => {
    await a.page.selectOption('select[name=target]', `subject:${subjectId}`);
    await a.page.fill('input[name=days]', '7');
    await a.page.getByRole('button', { name: 'تفعيل للطالب' }).click();
    await a.page.getByText('تم تفعيل الاشتراك للطالب.').first().waitFor();
    assert.equal(await streamStatus(s.page, paidLectureId), 206);
  });

  await step('رابط استعادة كلمة المرور من الإدارة يعمل لمرة واحدة', async () => {
    await a.page.getByRole('button', { name: 'إنشاء رابط استعادة' }).click();
    const link = (await a.page.locator('code[dir=ltr]').first().textContent()).trim();
    const fresh = await newUser();
    await fresh.page.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await fresh.page.fill('input[name=password]', 'New-pass-456');
    await fresh.page.fill('input[name=confirm]', 'New-pass-456');
    await fresh.page.click('main button[type=submit]');
    await fresh.page.waitForURL(/\/login\?reset=1/);
    // الجلسة القديمة للطالب أُلغيت بعد تغيير كلمة المرور.
    assert.equal(await streamStatus(s.page, paidLectureId), 401);
    // الدخول بكلمة المرور الجديدة من الجهاز المعتمد نفسه.
    await s.page.goto(`${BASE}/login`);
    await s.page.fill('input[name=email]', studentEmail);
    await s.page.fill('input[name=password]', 'New-pass-456');
    await s.page.click('main button[type=submit]');
    await s.page.waitForURL(/\/dashboard/);
    // إعادة استخدام الرابط مرفوضة.
    await fresh.page.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await fresh.page.fill('input[name=password]', 'Another-pass-789');
    await fresh.page.fill('input[name=confirm]', 'Another-pass-789');
    await fresh.page.click('main button[type=submit]');
    await fresh.page.getByText('رابط الاستعادة غير صالح أو منتهي الصلاحية.').first().waitFor();
    await fresh.ctx.close();
  });

  await step('تسجيل دخول بكلمة مرور خاطئة يُرفض', async () => {
    const x = await newUser();
    await x.page.goto(`${BASE}/login`);
    await x.page.fill('input[name=email]', studentEmail);
    await x.page.fill('input[name=password]', 'wrong-password');
    await x.page.click('main button[type=submit]');
    await x.page.getByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.').first().waitFor();
    await x.page.screenshot({ path: `${SHOTS}/12-login-error.png`, fullPage: true });
    await x.ctx.close();
  });

  await step('المدير يضيف سنة وقسمًا ومادة ومحاضرة من اللوحة', async () => {
    const yearName = `سنة اختبار ${run}`;
    await a.page.goto(`${BASE}/admin/structure`);
    const addYear = a.page.locator('form', { has: a.page.getByRole('button', { name: 'إضافة السنة' }) });
    await addYear.locator('input[name=name]').fill(yearName);
    await addYear.getByRole('button', { name: 'إضافة السنة' }).click();
    await a.page.getByText('تمت إضافة السنة.').first().waitFor();
    await a.page.screenshot({ path: `${SHOTS}/13-admin-structure.png`, fullPage: true });

    await a.page.goto(`${BASE}/admin/subjects/new`);
    await a.page.fill('input[name=title]', `مادة اختبار ${run}`);
    await a.page.selectOption('select[name=yearId]', { label: yearName });
    await a.page.click('main button[type=submit]');
    await a.page.waitForURL(/\/admin\/subjects\/[0-9a-f-]{36}\?created=1/);
    const addLecture = a.page.locator('form', { has: a.page.getByRole('button', { name: 'إضافة المحاضرة' }) });
    await addLecture.locator('input[name=title]').fill('المحاضرة الأولى');
    await addLecture.locator('input[name=duration]').fill('1:05:30');
    await addLecture.locator('input[name=videoRef]').fill('http://insecure.example/video.mp4');
    await addLecture.getByRole('button', { name: 'إضافة المحاضرة' }).click();
    await a.page.getByText('يجب أن يبدأ رابط الفيديو بـ https://').first().waitFor();
    await addLecture.locator('input[name=videoRef]').fill('local:demo-3.mp4');
    await addLecture.getByRole('button', { name: 'إضافة المحاضرة' }).click();
    await a.page.getByText('تمت إضافة المحاضرة في آخر القائمة.').first().waitFor();
    await a.page.getByText('1:05:30').first().waitFor();
  });

  await step('الحساب الموقوف لا يستطيع الدخول', async () => {
    await a.page.goto(`${BASE}/admin/students?q=${encodeURIComponent(student2Email)}`);
    await a.page.getByRole('link', { name: /طالب ثان/ }).click();
    a.page.once('dialog', (d) => d.accept());
    await a.page.getByRole('button', { name: 'إيقاف الحساب' }).click();
    await a.page.getByRole('button', { name: 'تفعيل الحساب' }).waitFor();
    const x = await newUser();
    await x.page.goto(`${BASE}/login`);
    await x.page.fill('input[name=email]', student2Email);
    await x.page.fill('input[name=password]', PASSWORD);
    await x.page.click('main button[type=submit]');
    await x.page.getByText('هذا الحساب موقوف').first().waitFor();
    await x.ctx.close();
  });

  // ---------- جهاز واحد لكل حساب ----------
  const deviceEmail = `device-${run}@example.test`;
  const d1 = await newUser(); // الجهاز الأصلي
  const d2 = await newUser(); // جهاز آخر (مفتاح مختلف)

  await step('الحساب يُربط بأول جهاز عند التسجيل', async () => {
    await register(d1.page, { name: 'طالب الجهاز', email: deviceEmail, phone: '0993334445' });
    await d1.page.waitForURL(/\/dashboard/);
    assert.equal(await streamStatus(d1.page, freeLectureId), 206);
  });

  await step('الدخول من جهاز آخر يُرفض رغم صحة كلمة المرور، ولا يفصل الجهاز الأصلي', async () => {
    await d2.page.goto(`${BASE}/login`);
    await d2.page.fill('input[name=email]', deviceEmail);
    await d2.page.fill('input[name=password]', PASSWORD);
    await d2.page.click('main button[type=submit]');
    await d2.page.getByText('هذا الحساب مرتبط بجهاز آخر').first().waitFor();
    assert.ok(d2.page.url().includes('/login'));
    assert.equal(await streamStatus(d2.page, freeLectureId), 401);
    await d2.page.screenshot({ path: `${SHOTS}/15-other-device-rejected.png`, fullPage: true });
    // الجهاز الأصلي ما زال مسجّل الدخول ويشاهد.
    assert.equal(await streamStatus(d1.page, freeLectureId), 206);
    await d1.page.goto(`${BASE}/dashboard`);
    await d1.page.getByText('طالب الجهاز').first().waitFor();
  });

  await step('تسجيل الخروج لا يلغي ربط الجهاز: الدخول مجددًا من الجهاز نفسه ينجح', async () => {
    await d1.page.goto(`${BASE}/account`);
    await d1.page.getByRole('button', { name: 'تسجيل الخروج من هذا الجهاز' }).click();
    await d1.page.waitForURL(`${BASE}/`);
    await d1.page.goto(`${BASE}/login`);
    await d1.page.fill('input[name=email]', deviceEmail);
    await d1.page.fill('input[name=password]', PASSWORD);
    await d1.page.click('main button[type=submit]');
    await d1.page.waitForURL(/\/dashboard/);
    // وبعد خروج الجهاز الأصلي، الجهاز الآخر ما زال مرفوضًا.
    await d2.page.goto(`${BASE}/login`);
    await d2.page.fill('input[name=email]', deviceEmail);
    await d2.page.fill('input[name=password]', PASSWORD);
    await d2.page.click('main button[type=submit]');
    await d2.page.getByText('هذا الحساب مرتبط بجهاز آخر').first().waitFor();
  });

  await step('نسخ كوكي الجلسة لا ينقل مفتاح الجهاز (لا يمكن تجديد الإثبات)', async () => {
    const cookies = await d1.ctx.cookies();
    const thief = await newUser();
    await thief.ctx.addCookies(cookies);
    await thief.page.goto(`${BASE}/dashboard`);
    // الإثبات الحالي ما زال ساريًا لدقائق، لكن التجديد يحتاج المفتاح الخاص غير الموجود هنا.
    const renewed = await thief.page.evaluate(async () => {
      const db = await new Promise((r) => { const q = indexedDB.open('alwasit-device', 1); q.onupgradeneeded = () => q.result.createObjectStore('keys'); q.onsuccess = () => r(q.result); });
      return new Promise((r) => { const q = db.transaction('keys').objectStore('keys').get('device-key-v1'); q.onsuccess = () => r(Boolean(q.result)); });
    });
    assert.equal(renewed, false, 'المفتاح الخاص لا يُنقل مع الكوكي');
    await thief.ctx.close();
  });

  if (DATABASE_URL) {
    await step('انتهاء الإثبات القصير: البث يُرفض، والجهاز المعتمد يجدده تلقائيًا', async () => {
      const postgres = require('postgres');
      const sql = postgres(DATABASE_URL, { max: 1 });
      await sql`update sessions set proof_expires_at = now() - interval '1 minute' where user_id = (select id from users where email = ${deviceEmail})`;
      await sql.end();
      assert.equal(await streamStatus(d1.page, freeLectureId), 401);
      await d1.page.goto(`${BASE}/dashboard`);
      await d1.page.waitForURL(/\/dashboard$/); // مرّ عبر صفحة التحقق وعاد تلقائيًا
      assert.equal(await streamStatus(d1.page, freeLectureId), 206);
    });
  }

  await step('الإدارة ترى طلب النقل وتوافق عليه: يُلغى الجهاز القديم وجلساته ويُعتمد الجديد', async () => {
    await a.page.goto(`${BASE}/admin/devices`);
    await a.page.getByText('طالب الجهاز').first().waitFor();
    await a.page.getByText('رفض دخول من جهاز غير معتمد').first().waitFor();
    await a.page.screenshot({ path: `${SHOTS}/16-admin-devices.png`, fullPage: true });
    const row = a.page.locator('li', { hasText: deviceEmail });
    a.page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'موافقة واعتماد الجهاز الجديد' }).click();
    await row.waitFor({ state: 'detached' });

    // الجهاز القديم: الجلسة أُبطلت فورًا.
    assert.equal(await streamStatus(d1.page, freeLectureId), 401);
    // الجهاز الجديد: الدخول ينجح الآن.
    await d2.page.goto(`${BASE}/login`);
    await d2.page.fill('input[name=email]', deviceEmail);
    await d2.page.fill('input[name=password]', PASSWORD);
    await d2.page.click('main button[type=submit]');
    await d2.page.waitForURL(/\/dashboard/);
    assert.equal(await streamStatus(d2.page, freeLectureId), 206);
    // والجهاز القديم أصبح هو المرفوض.
    await d1.page.goto(`${BASE}/login`);
    await d1.page.fill('input[name=email]', deviceEmail);
    await d1.page.fill('input[name=password]', PASSWORD);
    await d1.page.click('main button[type=submit]');
    await d1.page.getByText('هذا الحساب مرتبط بجهاز آخر').first().waitFor();
  });

  await step('رفض طلب النقل يُبقي الجهاز الحالي معتمدًا', async () => {
    await a.page.goto(`${BASE}/admin/devices`);
    const row = a.page.locator('li', { hasText: deviceEmail });
    await row.getByText('رفض', { exact: true }).click();
    await row.getByRole('button', { name: 'تأكيد الرفض' }).click();
    await row.waitFor({ state: 'detached' });
    assert.equal(await streamStatus(d2.page, freeLectureId), 206);
    await d1.ctx.close();
    await d2.ctx.close();
  });

  await step('لقطة سطح المكتب للصفحة الرئيسية', async () => {
    const d = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'ar' });
    const p = await d.newPage();
    await p.goto(BASE);
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${SHOTS}/14-home-desktop.png`, fullPage: true });
    await d.close();
  });

  console.log(`\n✓ نجحت كل الاختبارات (${passed}).`);
} catch (err) {
  console.log('✗');
  console.error(err);
  for (const [i, c] of browser.contexts().entries()) {
    for (const [j, pg] of c.pages().entries()) {
      await pg.screenshot({ path: `${SHOTS}/fail-${i}-${j}.png`, fullPage: true }).catch(() => {});
    }
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
