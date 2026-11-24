// البيانات الأولية للمنصة.
// - السنوات والأقسام والمواد والأساتذة: البيانات الرسمية لمركز الوسيط (من lib/seed.js في جذر المستودع).
// - المحاضرات: محتوى تجريبي فقط، معلَّم بوضوح بكلمة "تجريبية"، ويُحذف أو يُستبدل من لوحة الإدارة.
// يعمل مرة واحدة فقط: إذا وُجدت أي سنة في القاعدة لا يفعل شيئًا.

const TEACHERS = [
  {
    name: 'شعبان شحود',
    contacts: [
      { type: 'whatsapp', value: '963935350049' },
      { type: 'telegram', value: 'https://t.me/shabanshahoud2' },
      { type: 'facebook', value: 'https://www.facebook.com/share/1A8skHVGTf/' },
    ],
  },
  {
    name: 'يونس شحود',
    contacts: [
      { type: 'whatsapp', value: '963947468663' },
      { type: 'telegram', value: 'https://t.me/T_Younis_Shahoud' },
      { type: 'facebook', value: 'https://www.facebook.com/share/19ydC4c2pS/' },
    ],
  },
];

const YEARS = [
  { name: 'السنة الأولى', sections: [] },
  { name: 'السنة الثانية', sections: [{ name: 'A', kind: 'group' }, { name: 'B', kind: 'group' }] },
  { name: 'السنة الثالثة', sections: [] },
  {
    name: 'السنة الرابعة',
    sections: [
      { name: 'الجبر', kind: 'department' },
      { name: 'التحليل', kind: 'department' },
      { name: 'التطبيقية', kind: 'department' },
    ],
  },
];

// year: رقم السنة، section: للسنة الرابعة فقط.
const SUBJECTS = [
  { title: 'المتتاليات والسلاسل التابعية', year: 2, teacher: 'يونس شحود' },
  { title: 'ميكانيك النقطة المادية', year: 2, teacher: 'يونس شحود' },
  { title: 'التوبولوجيا العامة 1', year: 2, teacher: 'شعبان شحود' },
  { title: 'الجبر الخطي 1', year: 2, teacher: 'شعبان شحود' },
  { title: 'المعادلات التفاضلية 1', year: 2, teacher: 'شعبان شحود' },
  { title: 'التحليل العقدي 1', year: 3, teacher: 'يونس شحود' },
  { title: 'التحليل العددي', year: 3, teacher: 'يونس شحود' },
  { title: 'المعادلات الجزئية', year: 3, teacher: 'يونس شحود' },
  { title: 'نظرية المودولات', year: 3, teacher: 'شعبان شحود' },
  { title: 'نظرية الاحتمالات', year: 3, teacher: 'شعبان شحود' },
  { title: 'البرمجة بلغة C++', year: 3, teacher: 'شعبان شحود' },
  { title: 'المعادلات التكاملية', year: 4, section: 'التحليل', teacher: 'يونس شحود' },
  { title: 'الهندسة التفاضلية', year: 4, section: 'التحليل', teacher: 'يونس شحود' },
  { title: 'النمذجة الرياضية', year: 4, section: 'التطبيقية', teacher: 'شعبان شحود' },
  { title: 'ميكانيك المرونة', year: 4, section: 'التطبيقية', teacher: 'شعبان شحود' },
  { title: 'قواعد البيانات', year: 4, section: 'التطبيقية', teacher: 'شعبان شحود' },
  { title: 'البرمجة بلغة بايثون', year: 4, section: 'التطبيقية', teacher: 'شعبان شحود' },
];

const DEMO_NOTE = 'محتوى تجريبي لاختبار المشغّل والصلاحيات، يُستبدل بالمحاضرة الحقيقية من لوحة الإدارة.';
const DEMO_LECTURES = {
  'الجبر الخطي 1': [
    { title: 'محاضرة تجريبية 1 – مقدمة', file: 'demo-1.mp4', free: true },
    { title: 'محاضرة تجريبية 2', file: 'demo-2.mp4' },
    { title: 'محاضرة تجريبية 3', file: 'demo-3.mp4' },
  ],
  'التحليل العقدي 1': [
    { title: 'محاضرة تجريبية 1 – مقدمة', file: 'demo-1.mp4', free: true },
    { title: 'محاضرة تجريبية 2', file: 'demo-2.mp4' },
  ],
};
const DEMO_DURATION = 40; // ثانية (مدة الملفات التجريبية)

/** @param {import('postgres').Sql} sql */
export async function seedIfEmpty(sql) {
  const [{ n }] = await sql`select count(*)::int as n from years`;
  if (n > 0) {
    console.log('• القاعدة تحتوي بيانات، لا حاجة للبيانات الأولية.');
    return;
  }
  await sql.begin(async (tx) => {
    const teacherIds = {};
    for (const [i, t] of TEACHERS.entries()) {
      const [row] = await tx`insert into teachers (name, contacts, sort_order) values (${t.name}, ${JSON.stringify(t.contacts)}::jsonb, ${i}) returning id`;
      teacherIds[t.name] = row.id;
    }
    const yearIds = {};
    const sectionIds = {};
    for (const [i, y] of YEARS.entries()) {
      const [row] = await tx`insert into years (name, sort_order) values (${y.name}, ${i + 1}) returning id`;
      yearIds[i + 1] = row.id;
      for (const [j, s] of y.sections.entries()) {
        const [sec] = await tx`insert into sections (year_id, name, kind, sort_order) values (${row.id}, ${s.name}, ${s.kind}, ${j + 1}) returning id`;
        sectionIds[`${i + 1}:${s.name}`] = sec.id;
      }
    }
    for (const [i, s] of SUBJECTS.entries()) {
      const [row] = await tx`
        insert into subjects (title, year_id, section_id, teacher_id, sort_order)
        values (${s.title}, ${yearIds[s.year]}, ${s.section ? sectionIds[`${s.year}:${s.section}`] : null}, ${teacherIds[s.teacher]}, ${i})
        returning id`;
      for (const [k, l] of (DEMO_LECTURES[s.title] ?? []).entries()) {
        await tx`
          insert into lectures (subject_id, title, description, sort_order, duration_seconds, video_ref, is_free)
          values (${row.id}, ${l.title}, ${DEMO_NOTE}, ${k + 1}, ${DEMO_DURATION}, ${'local:' + l.file}, ${Boolean(l.free)})`;
      }
    }
  });
  console.log(`✓ تمت إضافة البيانات الأولية: ${YEARS.length} سنوات، ${SUBJECTS.length} مادة، ${TEACHERS.length} أستاذان، ومحاضرات تجريبية.`);
}

// تشغيل مباشر: node scripts/seed.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.loadEnvFile?.('.env');
  } catch {}
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL, { max: 1, prepare: false });
  try {
    await seedIfEmpty(sql);
  } finally {
    await sql.end();
  }
}
