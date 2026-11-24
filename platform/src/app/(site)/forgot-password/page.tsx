import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { forgotPasswordAction } from '@/server/actions/auth';

export const metadata: Metadata = { title: 'استعادة كلمة المرور' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="استعادة كلمة المرور" subtitle="أدخل بريدك المسجّل وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.">
      <ActionForm action={forgotPasswordAction} className="flex flex-col gap-4">
        <Field name="email" label="البريد الإلكتروني" type="email" inputMode="email" autoComplete="email" dir="ltr" required />
        <SubmitButton pendingText="جارٍ الإرسال…">إرسال رابط الاستعادة</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-ink-soft">
        تذكّرت كلمة المرور؟{' '}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </AuthShell>
  );
}
