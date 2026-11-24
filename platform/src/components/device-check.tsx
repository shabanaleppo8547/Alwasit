'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { renewDeviceProof } from '@/lib/device-renew';
import { logoutAction } from '@/server/actions/auth';

export function DeviceCheck({ next }: { next: string }) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'no_key' | 'mismatch' | 'failed'>('checking');

  useEffect(() => {
    renewDeviceProof()
      .then((r) => {
        if (r === 'ok') router.replace(next);
        else setState(r);
      })
      .catch(() => setState('failed'));
  }, [next, router]);

  if (state === 'checking') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <p className="font-semibold">جارٍ التحقق من جهازك…</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="leading-7 text-ink-soft">
        {state === 'failed'
          ? 'تعذّر التحقق من الجهاز. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.'
          : 'هذا المتصفح لم يعد يحمل مفتاح الجهاز المعتمد لحسابك (ربما مُسحت بيانات المتصفح). لاستخدام حسابك هنا سجّل الدخول من جديد، وستُرسل الإدارة موافقة نقل الجهاز.'}
      </p>
      {state === 'failed' && (
        <button className="btn-primary" onClick={() => location.reload()}>
          إعادة المحاولة
        </button>
      )}
      <form action={logoutAction}>
        <button className="btn-ghost w-full">تسجيل الخروج</button>
      </form>
    </div>
  );
}
