import Link from 'next/link';
import type { Metadata } from 'next';
import { AdminNav } from '@/components/admin-nav';
import { Logo } from '@/components/logo';
import { logoutAction } from '@/server/actions/auth';
import { requireAdmin } from '@/server/auth/session';
import { count, eq } from 'drizzle-orm';
import { db, schema } from '@/server/db';

export const metadata: Metadata = { title: { default: 'لوحة الإدارة', template: '%s | إدارة الوسيط' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(schema.deviceRequests)
    .where(eq(schema.deviceRequests.status, 'pending'));
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 z-30 bg-ink text-white lg:h-dvh print:hidden">
        <div className="flex flex-col gap-4 px-4 py-4 lg:h-full lg:py-6">
          <div className="flex items-center justify-between">
            <Link href="/admin">
              <Logo light />
            </Link>
            <span className="badge rounded-md bg-amber/20 text-amber lg:hidden">إدارة</span>
          </div>
          <AdminNav pendingDevices={Number(pending)} />
          <div className="mt-auto hidden flex-col gap-2 border-t border-white/10 pt-4 text-sm lg:flex">
            <p className="truncate text-white/60" dir="ltr">
              {admin.email}
            </p>
            <Link href="/" className="text-white/70 hover:text-white">
              ← عرض الموقع
            </Link>
            <form action={logoutAction}>
              <button className="text-white/70 hover:text-white">تسجيل الخروج</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
