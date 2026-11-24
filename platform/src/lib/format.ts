export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** تاريخ بالأرقام اللاتينية (أوضح لطلاب الرياضيات) وأسماء أشهر عربية. */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-SY-u-nu-latn', { dateStyle: 'medium' }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-SY-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(d),
  );
}

export function daysLeft(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400_000);
}

/** "1:05:30" أو "45:10" أو "90" (دقائق) → ثوانٍ. */
export function parseDuration(input: string): number | null {
  const v = input.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v) * 60;
  const parts = v.split(':').map(Number);
  if (parts.some((n) => !Number.isInteger(n) || n < 0) || parts.length > 3) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
