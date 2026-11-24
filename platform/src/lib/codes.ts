// أدوات مشتركة بين الواجهة والخادم (بلا أسرار).

/** يوحّد الرمز المُدخل: أحرف كبيرة، إزالة المسافات، إضافة الشرطات. يعيد null إن كانت الصيغة خاطئة. */
export function normalizeCode(raw: string): string | null {
  const compact = String(raw ?? '')
    .toUpperCase()
    .replace(/[\s\-_]/g, '')
    .replace(/^ALW/, '');
  if (!/^[A-Z2-9]{12}$/.test(compact)) return null;
  return `ALW-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
}
