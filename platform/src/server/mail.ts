import 'server-only';

/**
 * إرسال البريد عبر Resend إذا كان مفتاحه مضبوطًا.
 * يعيد false إن لم يكن الإرسال متاحًا، ليعرض النظام البديل (رابط من لوحة الإدارة).
 */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[mail:dev] إلى ${to}: ${subject}\n${html.replace(/<[^>]+>/g, ' ')}`);
    }
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) console.error('فشل إرسال البريد', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}
