'use client';

import type { ReactNode } from 'react';
import { ActionForm } from './forms';
import { getDeviceChallengeAction } from '@/server/actions/auth';
import { DeviceKeyError, signChallenge } from '@/lib/device-client';
import type { ActionState } from '@/lib/action';
import type { ProofPurpose } from '@/lib/device-proof';

/** نموذج دخول/تسجيل يرفق إثبات مفتاح هذا الجهاز (توقيع تحدٍّ من الخادم). */
export function DeviceAuthForm({
  action,
  purpose,
  className,
  children,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  purpose: ProofPurpose;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ActionForm
      action={action}
      className={className}
      beforeSubmit={async (fd) => {
        try {
          const { challenge, error } = await getDeviceChallengeAction();
          if (!challenge) return error ?? 'تعذّر الاتصال بالخادم.';
          const proof = await signChallenge(challenge, purpose);
          for (const [k, v] of Object.entries(proof)) fd.set(k, v);
        } catch (err) {
          return err instanceof DeviceKeyError ? err.message : 'تعذّر تجهيز مفتاح الجهاز في هذا المتصفح.';
        }
      }}
    >
      {children}
    </ActionForm>
  );
}
