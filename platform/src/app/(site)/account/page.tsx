import type { Metadata } from 'next';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { changePasswordAction, logoutAction, updateProfileAction } from '@/server/actions/auth';
import { requireUser } from '@/server/auth/session';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'حسابي' };

export default async function AccountPage() {
  const user = await requireUser('/account');
  return (
    <div className="page max-w-2xl py-8 sm:py-12">
      <h1 className="h-title">حسابي</h1>
      <p className="mt-1 text-sm text-ink-soft">
        <span dir="ltr">{user.email}</span> · عضو منذ {formatDate(user.createdAt)}
      </p>

      <section className="card mt-6 p-6">
        <h2 className="mb-4 font-bold">البيانات الشخصية</h2>
        <ActionForm action={updateProfileAction} className="flex flex-col gap-4">
          <Field name="fullName" label="الاسم الكامل" defaultValue={user.fullName} required />
          <Field name="phone" label="رقم الهاتف" type="tel" dir="ltr" defaultValue={user.phone} required />
          <SubmitButton className="btn-primary self-start">حفظ</SubmitButton>
        </ActionForm>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-4 font-bold">تغيير كلمة المرور</h2>
        <ActionForm action={changePasswordAction} className="flex flex-col gap-4" resetOnSuccess>
          <Field name="current" label="كلمة المرور الحالية" type="password" autoComplete="current-password" dir="ltr" required />
          <Field name="password" label="كلمة المرور الجديدة" type="password" autoComplete="new-password" dir="ltr" required />
          <Field name="confirm" label="تأكيد كلمة المرور" type="password" autoComplete="new-password" dir="ltr" required />
          <SubmitButton className="btn-primary self-start">تغيير كلمة المرور</SubmitButton>
        </ActionForm>
      </section>

      <form action={logoutAction} className="mt-6">
        <button className="btn-danger w-full sm:w-auto" type="submit">
          تسجيل الخروج من هذا الجهاز
        </button>
      </form>
    </div>
  );
}
