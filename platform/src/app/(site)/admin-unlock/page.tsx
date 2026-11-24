import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { adminUnlockAction } from '@/server/actions/auth';
import { getCurrentUser } from '@/server/auth/session';

export const metadata = { title: 'دخول الإدارة', robots: { index: false } };

export default async function AdminUnlockPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (!user.adminAccount) redirect('/dashboard?denied=1');
  if (user.adminUnlocked) redirect('/admin');
  return (
    <AuthShell title="دخول لوحة الإدارة" subtitle="خطوة تحقق إضافية: أدخل كلمة مرور الإدارة. تبقى اللوحة مفتوحة على هذا الجهاز 8 ساعات.">
      <ActionForm action={adminUnlockAction} className="flex flex-col gap-4">
        <Field name="adminPassword" label="كلمة مرور الإدارة" type="password" autoComplete="off" dir="ltr" required />
        <SubmitButton pendingText="جارٍ التحقق…">فتح لوحة الإدارة</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
