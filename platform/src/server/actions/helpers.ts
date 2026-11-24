import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/lib/action';

export function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors, nonce: Date.now() };
}

export function done(message: string): ActionState {
  return { ok: true, message, nonce: Date.now() };
}

export function parseForm<T extends z.ZodType>(schema: T, fd: FormData):
  | { ok: true; data: z.infer<T> }
  | { ok: false; state: ActionState } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('$ACTION')) continue;
    if (typeof v !== 'string') continue;
    if (k in raw) raw[k] = ([] as unknown[]).concat(raw[k], v);
    else raw[k] = v;
  }
  const res = schema.safeParse(raw);
  if (res.success) return { ok: true, data: res.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, state: fail('يرجى تصحيح الحقول المحددة.', fieldErrors) };
}

function pgCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^\d{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** يحوّل أخطاء قاعدة البيانات الشائعة إلى رسائل واضحة، ويمرّر إعادة التوجيه. */
export function handleError(err: unknown, context = 'العملية'): ActionState {
  unstable_rethrow(err);
  const code = pgCode(err);
  if (code === '23503') return fail('لا يمكن الحذف لأن عناصر أخرى مرتبطة به. احذفها أو انقلها أولًا.');
  if (code === '23505') return fail('هذا العنصر موجود مسبقًا.');
  console.error(`[${context}]`, err);
  return fail(`تعذّر إتمام ${context}. حاول مرة أخرى.`);
}

// ---------- مخططات مشتركة ----------

export const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} مطلوب.` })
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} مطلوب.` : `${label} قصير جدًا.`)
        .max(max, `${label} طويل جدًا.`),
    );

export const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((s) => (s ?? '').trim())
    .pipe(z.string().max(max, 'النص طويل جدًا.'))
    .transform((s) => s || null);

export const uuid = z.uuid('قيمة غير صالحة.');
export const optionalUuid = z
  .string()
  .optional()
  .transform((s) => (s ? s : null))
  .pipe(z.uuid('قيمة غير صالحة.').nullable());

export const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.literal('1')])
  .optional()
  .transform((v) => Boolean(v));

export const intField = (label: string, min: number, max: number) =>
  z.coerce.number({ error: `${label} يجب أن يكون رقمًا.` }).int(`${label} يجب أن يكون عددًا صحيحًا.`).min(min, `${label} أقل من المسموح.`).max(max, `${label} أكبر من المسموح.`);

export const optionalInt = (label: string, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((s, ctx) => {
      const v = (s ?? '').trim();
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `${label} يجب أن يكون عددًا صحيحًا بين ${min} و${max}.` });
        return z.NEVER;
      }
      return n;
    });

export const emailField = z
  .string({ error: 'البريد الإلكتروني مطلوب.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('البريد الإلكتروني غير صحيح.').max(254, 'البريد طويل جدًا.'));

export const passwordField = z
  .string({ error: 'كلمة المرور مطلوبة.' })
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
  .max(128, 'كلمة المرور طويلة جدًا.');

export const phoneField = z
  .string({ error: 'رقم الهاتف مطلوب.' })
  .transform((s) => s.replace(/[\s\-()]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, 'رقم الهاتف غير صحيح (8 إلى 15 رقمًا).'));

export function safeNext(next: unknown, fallback = '/dashboard'): string {
  const n = typeof next === 'string' ? next : '';
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : fallback;
}
