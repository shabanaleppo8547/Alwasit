import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { redeemAction } from '@/server/actions/redeem';
import { requireUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'تفعيل مادة' };

export default async function RedeemPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  await requireUser(code ? `/redeem?code=${encodeURIComponent(code)}` : '/redeem');
  return (
    <AuthShell title="تفعيل مادة" subtitle="أدخل رمز التفعيل الذي حصلت عليه من مركز الوسيط، أو امسح رمز QR بكاميرا هاتفك.">
      <ActionForm action={redeemAction} className="flex flex-col gap-4" resetOnSuccess>
        <Field
          name="code"
          label="رمز التفعيل"
          defaultValue={code ?? ''}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ALW-XXXX-XXXX-XXXX"
          className="text-center font-mono text-lg tracking-widest uppercase"
          required
        />
        <SubmitButton pendingText="جارٍ التحقق…">تفعيل</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-xs leading-5 text-ink-soft">
        كل رمز مرتبط بمادة محددة، ويُربط بحسابك عند التفعيل. لا تشارك رمزك مع أحد.
      </p>
    </AuthShell>
  );
}
