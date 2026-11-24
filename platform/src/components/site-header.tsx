import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { logoutAction } from '@/server/actions/auth';
import { Logo } from './logo';
import { DeviceKeepAlive } from './device-keepalive';

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      {user && user.deviceId && <DeviceKeepAlive />}
      <div className="page flex h-16 items-center justify-between gap-3">
        <Link href="/" aria-label="الصفحة الرئيسية">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {user.adminAccount && (
                <Link href="/admin" className="btn-ghost btn-sm hidden sm:inline-flex">
                  لوحة الإدارة
                </Link>
              )}
              <Link href="/dashboard" className="btn-primary btn-sm">
                لوحتي
              </Link>
              <form action={logoutAction}>
                <button className="btn-ghost btn-sm" type="submit" aria-label="تسجيل الخروج">
                  خروج
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost btn-sm">
                دخول
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                حساب جديد
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface/60">
      <div className="page flex flex-col gap-2 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} مركز الوسيط. جميع الحقوق محفوظة.</p>
        <p>المحتوى مخصص للمشتركين فقط، ويُمنع نسخه أو إعادة نشره.</p>
      </div>
    </footer>
  );
}
