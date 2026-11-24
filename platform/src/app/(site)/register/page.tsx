import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { registerAction } from '@/server/actions/auth';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect('/dashboard');
  return (
    <AuthShell title="أنشئ حسابك" subtitle="حساب واحد لكل طالب، تُربط به كل موادك واشتراكاتك.">
      <ActionForm action={registerAction} className="flex flex-col gap-4">
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
      </ActionForm>
      <p className="mt-6 text-center text-sm text-ink-soft">
        لديك حساب؟{' '}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-brand hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </AuthShell>
  );
}
