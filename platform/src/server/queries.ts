import 'server-only';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db, schema } from './db';

const { years, sections, subjects, teachers, lectures } = schema;

export type CatalogSubject = {
  id: string;
  title: string;
  description: string | null;
  yearId: string;
  sectionId: string | null;
  teacherName: string | null;
  lectureCount: number;
};

export type CatalogYear = {
  id: string;
  name: string;
  description: string | null;
  sections: { id: string; name: string; kind: 'group' | 'department' }[];
  subjects: CatalogSubject[];
};

/** الكتالوج العام: السنوات المنشورة مع أقسامها وموادها المنشورة. لا يتضمن أي مرجع فيديو. */
export async function getCatalog(opts: { includeHidden?: boolean } = {}): Promise<CatalogYear[]> {
  const pub = !opts.includeHidden;
  const [yearRows, sectionRows, subjectRows, counts] = await Promise.all([
    db.select().from(years).where(pub ? eq(years.isPublished, true) : undefined).orderBy(asc(years.sortOrder), asc(years.name)),
    db.select().from(sections).orderBy(asc(sections.sortOrder), asc(sections.name)),
    db
      .select({
        id: subjects.id,
        title: subjects.title,
        description: subjects.description,
        yearId: subjects.yearId,
        sectionId: subjects.sectionId,
        teacherName: teachers.name,
      })
      .from(subjects)
      .leftJoin(teachers, eq(teachers.id, subjects.teacherId))
      .where(pub ? eq(subjects.isPublished, true) : undefined)
      .orderBy(asc(subjects.sortOrder), asc(subjects.title)),
    db
      .select({ subjectId: lectures.subjectId, n: count() })
      .from(lectures)
      .where(pub ? eq(lectures.isPublished, true) : undefined)
      .groupBy(lectures.subjectId),
  ]);
  const countMap = new Map(counts.map((c) => [c.subjectId, Number(c.n)]));
  return yearRows.map((y) => ({
    id: y.id,
    name: y.name,
    description: y.description,
    sections: sectionRows.filter((s) => s.yearId === y.id).map((s) => ({ id: s.id, name: s.name, kind: s.kind })),
    subjects: subjectRows
      .filter((s) => s.yearId === y.id)
      .map((s) => ({ ...s, lectureCount: countMap.get(s.id) ?? 0 })),
  }));
}

export async function getPublishedTeachers() {
  const rows = await db
    .select()
    .from(teachers)
    .where(eq(teachers.isPublished, true))
    .orderBy(asc(teachers.sortOrder), asc(teachers.name));
  const subjectRows = rows.length
    ? await db
        .select({ teacherId: subjects.teacherId, title: subjects.title })
        .from(subjects)
        .where(and(eq(subjects.isPublished, true), inArray(subjects.teacherId, rows.map((r) => r.id))))
        .orderBy(asc(subjects.sortOrder))
    : [];
  return rows.map((t) => ({ ...t, subjects: subjectRows.filter((s) => s.teacherId === t.id).map((s) => s.title) }));
}

/** تفاصيل مادة للعرض العام/الطالب. مرجع الفيديو مستبعد عمدًا من الاستعلام. */
export async function getSubjectDetail(id: string, opts: { includeHidden?: boolean } = {}) {
  const pub = !opts.includeHidden;
  const [subject] = await db
    .select({
      id: subjects.id,
      title: subjects.title,
      description: subjects.description,
      priceNote: subjects.priceNote,
      isPublished: subjects.isPublished,
      yearId: years.id,
      yearName: years.name,
      sectionName: sections.name,
      sectionKind: sections.kind,
      teacherId: teachers.id,
      teacherName: teachers.name,
      teacherTitle: teachers.title,
    })
    .from(subjects)
    .innerJoin(years, eq(years.id, subjects.yearId))
    .leftJoin(sections, eq(sections.id, subjects.sectionId))
    .leftJoin(teachers, eq(teachers.id, subjects.teacherId))
    .where(pub ? and(eq(subjects.id, id), eq(subjects.isPublished, true)) : eq(subjects.id, id))
    .limit(1);
  if (!subject) return null;
  const lectureRows = await db
    .select({
      id: lectures.id,
      subjectId: lectures.subjectId,
      title: lectures.title,
      description: lectures.description,
      sortOrder: lectures.sortOrder,
      durationSeconds: lectures.durationSeconds,
      isFree: lectures.isFree,
      isPublished: lectures.isPublished,
    })
    .from(lectures)
    .where(pub ? and(eq(lectures.subjectId, id), eq(lectures.isPublished, true)) : eq(lectures.subjectId, id))
    .orderBy(asc(lectures.sortOrder), asc(lectures.createdAt));
  return { subject, lectures: lectureRows };
}

export function sectionLabel(kind: 'group' | 'department' | null | undefined, name: string | null | undefined) {
  if (!name) return null;
  return kind === 'group' ? `الفئة ${name}` : `قسم ${name}`;
}

/** خيارات الاشتراك للوحة الإدارة (مواد كاملة + حزم)، مجمّعة حسب السنة. */
export async function getTargetOptions() {
  const [ys, subs, bs] = await Promise.all([
    db.select({ id: years.id, name: years.name }).from(years).orderBy(asc(years.sortOrder)),
    db
      .select({ id: subjects.id, title: subjects.title, yearId: subjects.yearId })
      .from(subjects)
      .orderBy(asc(subjects.sortOrder), asc(subjects.title)),
    db.select({ id: schema.bundles.id, title: schema.bundles.title, subjectId: schema.bundles.subjectId }).from(schema.bundles),
  ]);
  return ys
    .map((y) => ({
      yearName: y.name,
      subjects: subs
        .filter((s) => s.yearId === y.id)
        .map((s) => ({ id: s.id, title: s.title, bundles: bs.filter((b) => b.subjectId === s.id) })),
    }))
    .filter((y) => y.subjects.length);
}
