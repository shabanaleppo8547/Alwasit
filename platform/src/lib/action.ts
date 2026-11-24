export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** معرّف يتغيّر مع كل نتيجة لإعادة ضبط النماذج بعد النجاح. */
  nonce?: number;
  /** رابط اختياري يُعرض مع رسالة النجاح. */
  href?: string;
  /** رُفض الدخول لأن الحساب مرتبط بجهاز آخر. */
  deviceBlocked?: boolean;
};

export const initialState: ActionState = {};
