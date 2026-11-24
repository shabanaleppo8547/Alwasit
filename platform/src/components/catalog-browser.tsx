'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CatalogYear } from '@/server/queries';

type Status = 'active' | 'partial' | 'none';

/** متصفح السنوات والمواد: تبويب لكل سنة، وتصفية حسب القسم أو الفئة. */
export function CatalogBrowser({
  years,
  statuses,
  emptyHint,
}: {
  years: CatalogYear[];
  statuses?: Record<string, Status>;
  emptyHint?: string;
}) {
  const [yearId, setYearId] = useState((years.find((y) => y.subjects.length) ?? years[0])?.id);
  const [sectionId, setSectionId] = useState<string | 'all'>('all');
  const year = years.find((y) => y.id === yearId) ?? years[0];
  const subjects = useMemo(() => {
    if (!year) return [];
    if (sectionId === 'all') return year.subjects;
    return year.subjects.filter((s) => s.sectionId === sectionId || s.sectionId === null);
  }, [year, sectionId]);

  if (!year) return <p className="text-ink-soft">{emptyHint ?? 'لا توجد سنوات منشورة بعد.'}</p>;

  return (
    <div>
      <div role="tablist" aria-label="السنوات الدراسية" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {years.map((y) => (
          <button
            key={y.id}
            role="tab"
            aria-selected={y.id === year.id}
            onClick={() => {
              setYearId(y.id);
              setSectionId('all');
            }}
            className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              y.id === year.id ? 'bg-ink text-white shadow-md' : 'bg-surface text-ink-soft ring-1 ring-line hover:text-ink'
            }`}
          >
            {y.name}
            <span className={`ms-2 text-xs ${y.id === year.id ? 'text-white/60' : 'text-ink-soft/70'}`}>{y.subjects.length}</span>
          </button>
        ))}
      </div>

      {year.sections.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-soft">
            {year.sections.some((s) => s.kind === 'department') ? 'القسم:' : 'الفئة:'}
          </span>
          {[{ id: 'all', name: 'الكل' }, ...year.sections].map((s) => (
            <button
              key={s.id}
              onClick={() => setSectionId(s.id)}
              aria-pressed={sectionId === s.id}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                sectionId === s.id ? 'bg-brand text-white' : 'bg-brand-soft text-brand-deep hover:bg-brand/15'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card mt-5 p-8 text-center text-ink-soft">لا توجد مواد منشورة في هذه السنة بعد.</div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s, i) => {
            const st = statuses?.[s.id];
            const section = year.sections.find((x) => x.id === s.sectionId);
            return (
              <li key={s.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <Link
                  href={`/subjects/${s.id}`}
                  className={`card group flex h-full flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:border-brand/40 ${
                    st === 'active' ? 'ring-2 ring-brand/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[17px] font-bold leading-snug">{s.title}</h3>
                    {st === 'active' ? (
                      <span className="badge-on shrink-0">● مفعّلة</span>
                    ) : st === 'partial' ? (
                      <span className="badge-amber shrink-0">مفعّلة جزئيًا</span>
                    ) : statuses ? (
                      <span className="badge-off shrink-0">🔒 غير مفعّلة</span>
                    ) : null}
                  </div>
                  {s.teacherName && <p className="text-sm text-ink-soft">أ. {s.teacherName}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-ink-soft">
                    <span>
                      {s.lectureCount > 0 ? `${s.lectureCount} محاضرة` : 'المحاضرات قريبًا'}
                      {section && <span className="ms-2 rounded bg-ink/5 px-1.5 py-0.5">{section.name}</span>}
                    </span>
                    <span className="font-semibold text-brand transition group-hover:-translate-x-1">عرض ←</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
