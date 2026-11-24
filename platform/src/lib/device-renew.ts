'use client';

import { getDeviceChallengeAction, renewDeviceProofAction } from '@/server/actions/auth';
import { hasDeviceKey, signChallenge } from './device-client';

export type RenewResult = 'ok' | 'no_key' | 'mismatch' | 'failed';

/** يجدّد إثبات الجهاز للجلسة الحالية (توقيع تحدٍّ جديد بمفتاح الجهاز). */
export async function renewDeviceProof(): Promise<RenewResult> {
  if (!(await hasDeviceKey())) return 'no_key';
  const { challenge } = await getDeviceChallengeAction();
  if (!challenge) return 'failed';
  const proof = await signChallenge(challenge, 'renew', false);
  const res = await renewDeviceProofAction(proof);
  if (res.ok) return 'ok';
  return res.reason === 'mismatch' ? 'mismatch' : 'failed';
}
