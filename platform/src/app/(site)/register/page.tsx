import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { Field, SubmitButton } from '@/components/forms';
import { DeviceAuthForm } from '@/components/device-auth-form';
import { registerAction } from '@/server/actions/auth';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect('/dashboard');
  return (
    <AuthShell title="أنشئ حسابك" subtitle="حساب واحد لكل طالب، تُربط به كل موادك واشتراكاتك.">
      <DeviceAuthForm action={registerAction} purpose="register" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ''} />
        <Field name="fullName" label="الاسم الكامل" autoComplete="name" required placeholder="كما تريد أن يظهر للمركز" />
        <Field
          name="phone"
          label="رقم الهاتف"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          placeholder="09xxxxxxxx أو +963…"
          hint="يستخدمه المركز للتواصل معك بشأن اشتراكك."
        />
        <Field name="email" label="البريد الإلكتروني" type="email" inputMode="email" autoComplete="email" dir="ltr" required />
        <Field name="password" label="كلمة المرور" type="password" autoComplete="new-password" dir="ltr" required hint="8 أحرف على الأقل." />
        <Field name="confirm" label="تأكيد كلمة المرور" type="password" autoComplete="new-password" dir="ltr" required />
        <SubmitButton pendingText="جارٍ إنشاء الحساب…">إنشاء الحساب</SubmitButton>
      </DeviceAuthForm>
      <p className="mt-5 rounded-xl bg-paper p-3 text-xs leading-6 text-ink-soft ring-1 ring-line">
        🔒 سيُربط حسابك بهذا الجهاز وهذا المتصفح. سجّل من الجهاز الذي ستتابع منه المحاضرات دائمًا، ولا تستخدم وضع التصفح
        الخفي.
      </p>
      <p className="mt-6 text-center text-sm text-ink-soft">
        لديك حساب؟{' '}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-brand hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </AuthShell>
  );
}
