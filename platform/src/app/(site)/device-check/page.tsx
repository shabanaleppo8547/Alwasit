import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { DeviceCheck } from '@/components/device-check';
import { getCurrentUser } from '@/server/auth/session';
import { safeNext } from '@/server/actions/helpers';

export const metadata = { title: 'التحقق من الجهاز' };

export default async function DeviceCheckPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next, '/dashboard');
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(target)}`);
  if (user.proofFresh) redirect(target);
  return (
    <AuthShell title="التحقق من الجهاز" subtitle="حسابك مرتبط بجهاز واحد معتمد. نتحقق تلقائيًا أن هذا هو جهازك.">
      <DeviceCheck next={target} />
    </AuthShell>
  );
}
