import { asc } from 'drizzle-orm';
import { AdminTitle, Empty, Panel } from '@/components/admin-ui';
import { SubjectForm } from '@/components/subject-form';
import { saveSubjectAction } from '@/server/actions/admin-content';
import { db, schema } from '@/server/db';

export const metadata = { title: 'مادة جديدة' };

export default async function NewSubjectPage() {
  const [years, sections, teachers] = await Promise.all([
    db.select({ id: schema.years.id, name: schema.years.name }).from(schema.years).orderBy(asc(schema.years.sortOrder)),
    db
      .select({ id: schema.sections.id, name: schema.sections.name, yearId: schema.sections.yearId, kind: schema.sections.kind })
      .from(schema.sections)
      .orderBy(asc(schema.sections.sortOrder)),
    db.select({ id: schema.teachers.id, name: schema.teachers.name }).from(schema.teachers).orderBy(asc(schema.teachers.sortOrder)),
  ]);
  return (
    <>
      <AdminTitle title="مادة جديدة" />
      <Panel>
        {years.length === 0 ? (
          <Empty>أضف سنة دراسية أولًا من صفحة السنوات والأقسام.</Empty>
        ) : (
          <SubjectForm action={saveSubjectAction} years={years} sections={sections} teachers={teachers} />
        )}
      </Panel>
    </>
  );
}
