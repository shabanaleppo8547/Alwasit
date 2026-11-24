'use client';

import { createContext, startTransition, use, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';

const Pending = createContext(false);
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { ActionState } from '@/lib/action';

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** نموذج مربوط بإجراء خادم: يعرض رسالة النتيجة وأخطاء الحقول، ويعيد الضبط بعد النجاح إن طُلب. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  hideMessage = false,
  beforeSubmit,
}: {
  /** خطوة غير متزامنة قبل الإرسال (مثل توقيع تحدي الجهاز). تعيد رسالة خطأ لإيقاف الإرسال. */
  beforeSubmit?: (fd: FormData) => Promise<string | void>;
  action: Action;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  hideMessage?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      noValidate
      onSubmit={(e) => {
        // نرسل يدويًا حتى لا يمسح React الحقول عند ظهور خطأ تحقق؛ المسح يتم فقط بعد النجاح.
        e.preventDefault();
        if (isPending || preparing) return;
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        setLocalError(null);
        if (!beforeSubmit) {
          startTransition(() => formAction(fd));
          return;
        }
        setPreparing(true);
        beforeSubmit(fd)
          .then((err) => {
            if (err) setLocalError(err);
            else startTransition(() => formAction(fd));
          })
          .catch(() => setLocalError('حدث خطأ غير متوقع. حدّث الصفحة وحاول مجددًا.'))
          .finally(() => setPreparing(false));
      }}
    >
      <Pending value={isPending || preparing}>
        <FieldErrorsContext value={state.fieldErrors}>
          {typeof children === 'function' ? children(state) : children}
        </FieldErrorsContext>
      </Pending>
      {!hideMessage && <FormMessage state={localError ? { ok: false, message: localError } : state} />}
    </form>
  );
}

const FieldErrors = createContext<Record<string, string> | undefined>(undefined);
function FieldErrorsContext({ value, children }: { value?: Record<string, string>; children: ReactNode }) {
  return <FieldErrors value={value}>{children}</FieldErrors>;
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div
      role={state.ok ? 'status' : 'alert'}
      className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
        state.ok ? 'bg-brand-soft text-brand-deep' : 'bg-danger-soft text-danger'
      }`}
    >
      {state.message}
      {state.href && <CopyableLink href={state.href} />}
    </div>
  );
}

function CopyableLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  if (href.startsWith('/')) {
    return (
      <Link href={href} className="mt-2 block font-bold underline underline-offset-4">
        انتقل الآن ←
      </Link>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-2">
      <code dir="ltr" className="block break-all rounded-lg bg-white/70 p-2 text-xs">
        {href}
      </code>
      <button
        type="button"
        className="btn-ghost btn-sm self-start"
        onClick={() => navigator.clipboard.writeText(href).then(() => setCopied(true))}
      >
        {copied ? 'تم النسخ ✓' : 'نسخ الرابط'}
      </button>
    </div>
  );
}

export function SubmitButton({
  children,
  className = 'btn-primary w-full',
  pendingText = 'جارٍ التنفيذ…',
  name,
  value,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const pending = status.pending || use(Pending);
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} name={name} value={value}>
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  textarea?: boolean;
  rows?: number;
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field({ name, label, hint, textarea, rows = 3, className, id: idSuffix, ...rest }: FieldProps) {
  const errors = use(FieldErrors);
  const error = errors?.[name];
  const id = `f-${name}-${idSuffix ?? ''}`;
  const common = {
    id,
    name,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
    className: `input ${className ?? ''}`,
  };
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {textarea ? (
        <textarea {...common} rows={rows} {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...common} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  name,
  label,
  children,
  hint,
  id: idSuffix,
  ...rest
}: { name: string; label: string; hint?: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const errors = use(FieldErrors);
  const error = errors?.[name];
  const id = `s-${name}-${idSuffix ?? ''}`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} name={name} className="input" aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
      {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 accent-[var(--color-brand)]" />
      {label}
    </label>
  );
}

/** زر صغير ينفّذ إجراءً واحدًا (حذف، تحريك، تبديل) مع تأكيد اختياري. */
export function ActionButton({
  action,
  fields,
  children,
  className = 'btn-ghost btn-sm',
  confirm,
  title,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  title?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="contents"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton className={className} pendingText="…">
        <span title={title}>{children}</span>
      </SubmitButton>
      {state.ok === false && state.message && (
        <span role="alert" className="ms-2 text-xs text-danger">
          {state.message}
        </span>
      )}
    </form>
  );
}
