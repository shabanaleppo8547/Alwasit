import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { resetPasswordAction } from '@/server/actions/auth';

export const metadata: Metadata = { title: 'تعيين كلمة مرور جديدة', referrer: 'no-referrer' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthShell title="الرابط غير مكتمل" subtitle="افتح الرابط كاملًا كما وصلك، أو اطلب رابطًا جديدًا.">
        <Link href="/forgot-password" className="btn-primary w-full">
          طلب رابط جديد
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="كلمة مرور جديدة" subtitle="بعد الحفظ سيتم تسجيل الخروج من كل الأجهزة الأخرى.">
      <ActionForm action={resetPasswordAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <Field name="password" label="كلمة المرور الجديدة" type="password" autoComplete="new-password" dir="ltr" required hint="8 أحرف على الأقل." />
        <Field name="confirm" label="تأكيد كلمة المرور" type="password" autoComplete="new-password" dir="ltr" required />
        <SubmitButton pendingText="جارٍ الحفظ…">حفظ كلمة المرور</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
