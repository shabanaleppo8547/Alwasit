import Link from 'next/link';
import { CatalogBrowser } from '@/components/catalog-browser';
import { getCurrentUser } from '@/server/auth/session';
import { getCatalog, getPublishedTeachers } from '@/server/queries';

export const dynamic = 'force-dynamic';

const GLYPHS = [
  { c: '∫', cls: 'top-10 start-[8%] text-6xl' },
  { c: '∑', cls: 'top-[55%] start-[4%] text-5xl [animation-delay:-3s]' },
  { c: '∂', cls: 'top-16 end-[10%] text-5xl [animation-delay:-5s]' },
  { c: 'π', cls: 'bottom-12 end-[18%] text-6xl [animation-delay:-2s]' },
  { c: '∞', cls: 'top-[42%] end-[3%] text-4xl [animation-delay:-7s]' },
];

const CONTACT_LABEL: Record<string, string> = {
  whatsapp: 'واتساب',
  telegram: 'تيليغرام',
  facebook: 'فيسبوك',
  phone: 'هاتف',
  other: 'رابط',
};

function contactHref(type: string, value: string) {
  if (type === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`;
  if (type === 'phone') return `tel:${value}`;
  return value;
}

export default async function HomePage() {
  const [user, catalog, teachers] = await Promise.all([getCurrentUser(), getCatalog(), getPublishedTeachers()]);
  const subjectCount = catalog.reduce((n, y) => n + y.subjects.length, 0);
  const lectureCount = catalog.reduce((n, y) => n + y.subjects.reduce((m, s) => m + s.lectureCount, 0), 0);

  return (
    <>
      {/* البطل */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="math-grid absolute inset-0" />
        <div className="absolute -top-40 end-[-10%] h-[28rem] w-[28rem] rounded-full bg-brand/40 blur-3xl" />
        <div className="absolute -bottom-48 start-[-10%] h-[26rem] w-[26rem] rounded-full bg-amber/20 blur-3xl" />
        {GLYPHS.map((g) => (
          <span
            key={g.c}
            aria-hidden
            className={`animate-float pointer-events-none absolute hidden font-serif text-white/10 select-none sm:block ${g.cls}`}
          >
            {g.c}
          </span>
        ))}

        <div className="page relative py-16 sm:py-24">
          <p className="animate-rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            لطلاب الجامعات داخل سوريا وخارجها
          </p>
          <h1 className="animate-rise mt-5 max-w-2xl text-4xl leading-[1.25] font-bold [animation-delay:80ms] sm:text-5xl">
            محاضراتك الجامعية،
            <br />
            <span className="text-amber">مرتّبة كما يجب.</span>
          </h1>
          <p className="animate-rise mt-5 max-w-xl text-base leading-8 text-white/75 [animation-delay:160ms] sm:text-lg">
            منصة مركز الوسيط تجمع محاضرات الفيديو حسب السنة والقسم والمادة. فعّل المادة التي اشتركت بها، وتابع شرح
            أساتذتك بالترتيب ومن أي جهاز.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3 [animation-delay:240ms]">
            {user ? (
              <Link href="/dashboard" className="btn-amber">
                الذهاب إلى لوحتي
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn-amber">
                  أنشئ حسابك مجانًا
                </Link>
                <Link href="/login" className="btn border border-white/25 text-white hover:bg-white/10">
                  تسجيل الدخول
                </Link>
              </>
            )}
          </div>

          <dl className="animate-rise mt-12 grid max-w-lg grid-cols-3 gap-3 [animation-delay:320ms]">
            {[
              { n: subjectCount, l: 'مادة' },
              { n: lectureCount, l: 'محاضرة' },
              { n: teachers.length, l: teachers.length === 1 ? 'أستاذ' : 'أساتذة' },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <dt className="sr-only">{s.l}</dt>
                <dd className="text-2xl font-bold">
                  <span className="ltr-nums">{s.n}</span>
                  <span className="ms-1.5 text-sm font-medium text-white/60">{s.l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* كيف تعمل */}
      <section className="page -mt-8 relative z-10">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { t: 'أنشئ حسابك', d: 'بالاسم ورقم الهاتف والبريد الإلكتروني، خلال أقل من دقيقة.' },
            { t: 'فعّل المادة', d: 'بعد الاشتراك لدى المركز تحصل على رمز تفعيل أو تُفعَّل المادة لحسابك مباشرة.' },
            { t: 'شاهد وتابع', d: 'كل محاضرات المادة بالترتيب، مع حالة اشتراكك وتاريخ انتهائه.' },
          ].map((s, i) => (
            <li key={s.t} className="card flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg font-bold text-brand">
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold">{s.t}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* السنوات والمواد */}
      <section id="subjects" className="page mt-16 scroll-mt-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brand">الخطة الدراسية</p>
            <h2 className="h-title mt-1">السنوات والمواد المتاحة</h2>
          </div>
          {!user && (
            <Link href="/register" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
              سجّل لتفعيل موادك ←
            </Link>
          )}
        </div>
        <CatalogBrowser years={catalog} />
      </section>

      {/* الأساتذة */}
      {teachers.length > 0 && (
        <section id="teachers" className="page mt-20 scroll-mt-20">
          <p className="text-sm font-semibold text-brand">فريق التدريس</p>
          <h2 className="h-title mt-1 mb-6">أساتذة المركز</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {teachers.map((t) => (
              <li key={t.id} className="card flex flex-col gap-4 p-6">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-xl font-bold text-amber">
                    {t.name.trim().charAt(0)}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold">أ. {t.name}</h3>
                    {t.title && <p className="text-sm text-ink-soft">{t.title}</p>}
                  </div>
                </div>
                {t.bio && <p className="text-sm leading-7 text-ink-soft">{t.bio}</p>}
                {t.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.subjects.slice(0, 8).map((s) => (
                      <span key={s} className="rounded-lg bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line">
                        {s}
                      </span>
                    ))}
                    {t.subjects.length > 8 && <span className="px-1 text-xs text-ink-soft">+{t.subjects.length - 8}</span>}
                  </div>
                )}
                {t.contacts.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
                    {t.contacts.map((c) => (
                      <a
                        key={c.type + c.value}
                        href={contactHref(c.type, c.value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost btn-sm"
                      >
                        {CONTACT_LABEL[c.type] ?? c.type}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* دعوة */}
      {!user && (
        <section className="page mt-20">
          <div className="relative overflow-hidden rounded-3xl bg-brand p-8 text-white sm:p-12">
            <div className="math-grid absolute inset-0 opacity-60" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">لديك رمز تفعيل من المركز؟</h2>
                <p className="mt-2 text-white/80">أنشئ حسابك ثم أدخل الرمز لتفتح محاضرات مادتك فورًا.</p>
              </div>
              <Link href="/register?next=/redeem" className="btn-amber">
                ابدأ الآن
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
