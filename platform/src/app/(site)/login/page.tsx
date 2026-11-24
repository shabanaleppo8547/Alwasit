import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { Field, SubmitButton } from '@/components/forms';
import { DeviceAuthForm } from '@/components/device-auth-form';
import { loginAction } from '@/server/actions/auth';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
  return (
    <AuthShell title="أهلًا بعودتك" subtitle="سجّل الدخول لمتابعة محاضراتك.">
      {reset && (
        <p role="status" className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-deep">
          تم تعيين كلمة المرور الجديدة. سجّل الدخول بها الآن.
        </p>
      )}
      <DeviceAuthForm action={loginAction} purpose="login" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ''} />
        <Field name="email" label="البريد الإلكتروني" type="email" autoComplete="email" inputMode="email" dir="ltr" required />
        <Field name="password" label="كلمة المرور" type="password" autoComplete="current-password" dir="ltr" required />
        <div className="-mt-1 text-start">
          <Link href="/forgot-password" className="text-sm font-semibold text-brand hover:underline">
            نسيت كلمة المرور؟
          </Link>
        </div>
        <SubmitButton pendingText="جارٍ الدخول…">تسجيل الدخول</SubmitButton>
      </DeviceAuthForm>
      <p className="mt-5 rounded-xl bg-paper p-3 text-xs leading-6 text-ink-soft ring-1 ring-line">
        🔒 كل حساب طالب يعمل على جهاز واحد معتمد (أول جهاز تسجّل منه). لنقل حسابك إلى جهاز آخر سجّل الدخول منه، وستراجع
        الإدارة الطلب. لا تستخدم وضع التصفح الخفي، ولا تمسح بيانات الموقع.
      </p>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ليس لديك حساب؟{' '}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-brand hover:underline">
          أنشئ حسابًا جديدًا
        </Link>
      </p>
    </AuthShell>
  );
}
