import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-7xl font-bold text-brand/20">404</p>
      <h1 className="text-xl font-bold">الصفحة غير موجودة</h1>
      <p className="text-ink-soft">ربما حُذفت أو أن الرابط غير صحيح.</p>
      <Link href="/" className="btn-primary">
        العودة للرئيسية
      </Link>
    </div>
  );
}
