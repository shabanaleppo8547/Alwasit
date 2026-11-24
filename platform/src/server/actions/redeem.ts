'use server';

import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/action';
import { requireUser } from '../auth/session';
import { redeemCode } from '../codes';
import { hit } from '../rate-limit';
import { done, fail, handleError } from './helpers';
import { formatDate } from '@/lib/format';

export async function redeemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/redeem');
  const code = String(fd.get('code') ?? '');
  try {
    if (!(await hit(`redeem:${user.id}`, 10, 900))) {
      return fail('محاولات كثيرة لإدخال الرموز. انتظر ربع ساعة ثم حاول مجددًا.');
    }
    const res = await redeemCode(user.id, code);
    if (!res.ok) return fail(res.message, { code: res.message });
    revalidatePath('/dashboard');
    const msg = res.expiresAt
      ? `تم التفعيل بنجاح! الصلاحية سارية حتى ${formatDate(res.expiresAt)}.`
      : 'تم التفعيل بنجاح! الصلاحية دائمة.';
    return { ...done(msg), href: `/subjects/${res.subjectId}` };
  } catch (err) {
    return handleError(err, 'تفعيل الرمز');
  }
}
