import Link from 'next/link';
import { formatDuration } from '@/lib/format';

export type LectureItem = {
  id: string;
  title: string;
  durationSeconds: number | null;
  isFree: boolean;
  unlocked: boolean;
};

export function LectureList({ lectures, currentId, loggedIn }: { lectures: LectureItem[]; currentId?: string; loggedIn: boolean }) {
  if (!lectures.length) {
    return <div className="card p-8 text-center text-ink-soft">لم تُضف محاضرات لهذه المادة بعد.</div>;
  }
  return (
    <ol className="card divide-y divide-line overflow-hidden">
      {lectures.map((l, i) => {
        const current = l.id === currentId;
        const body = (
          <>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                current ? 'bg-brand text-white' : l.unlocked ? 'bg-brand-soft text-brand' : 'bg-ink/5 text-ink-soft'
              }`}
            >
              {l.unlocked ? (current ? '▶' : i + 1) : '🔒'}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate font-semibold ${l.unlocked ? '' : 'text-ink-soft'}`}>{l.title}</span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                {formatDuration(l.durationSeconds) && <span className="ltr-nums">{formatDuration(l.durationSeconds)}</span>}
                {l.isFree && <span className="badge-amber !py-0.5">مجانية</span>}
                {!l.unlocked && <span>{loggedIn ? 'تحتاج تفعيل المادة' : 'سجّل الدخول للمشاهدة'}</span>}
              </span>
            </span>
          </>
        );
        return (
          <li key={l.id}>
            {l.unlocked ? (
              <Link
                href={`/lectures/${l.id}`}
                aria-current={current ? 'true' : undefined}
                className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-paper ${current ? 'bg-brand-soft/60' : ''}`}
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3.5 opacity-80">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
