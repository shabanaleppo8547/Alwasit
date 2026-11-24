'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
      <p className="max-w-sm text-ink-soft">قد يكون الاتصال بالخادم ضعيفًا. حاول مرة أخرى بعد لحظات.</p>
      <button onClick={reset} className="btn-primary">
        إعادة المحاولة
      </button>
    </div>
  );
}
